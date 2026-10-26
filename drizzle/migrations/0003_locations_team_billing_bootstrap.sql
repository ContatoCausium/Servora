-- ===== Locations: operational fields =====
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.locations SET status = 'placeholder' WHERE slug IN ('loc_marao_2','loc_marao_3');
UPDATE public.locations SET is_verified = true, address = '61 Hollis St, Framingham, MA 01702' WHERE slug = 'loc_marao_framingham';

ALTER TABLE public.locations ADD CONSTRAINT locations_status_chk CHECK (status IN ('active','inactive','placeholder'));

-- ===== Invitations: store scope =====
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS location_ids uuid[] NOT NULL DEFAULT '{}';

-- ===== Store access: only owners are org-wide; managers and staff are scoped to assigned stores =====
CREATE OR REPLACE FUNCTION public.can_access_location(_location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.locations l
    join public.organization_members m on m.org_id = l.org_id and m.user_id = auth.uid()
    where l.id = _location_id
      and (m.role = 'owner'
           or exists (select 1 from public.member_location_access a where a.member_id = m.id and a.location_id = l.id)));
$$;

CREATE OR REPLACE FUNCTION public.my_member(_org_id uuid)
RETURNS public.organization_members LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select * from public.organization_members where org_id = _org_id and user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.organization_members where org_id = _org_id and user_id = auth.uid() and role = 'owner');
$$;

-- Locations a member is scoped to (owners: all stores).
CREATE OR REPLACE FUNCTION public.member_scope(_member_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select l.id from public.organization_members m join public.locations l on l.org_id = m.org_id
   where m.id = _member_id and (m.role = 'owner'
     or exists (select 1 from public.member_location_access a where a.member_id = m.id and a.location_id = l.id));
$$;

-- ===== Billing =====
CREATE TABLE public.billing_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_per_location_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  default_store_limit integer NOT NULL DEFAULT 1,
  trial_days integer NOT NULL DEFAULT 14,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_price_id text,
  is_placeholder_pricing boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT ALL ON public.billing_plans TO service_role;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read plans" ON public.billing_plans FOR SELECT TO authenticated USING (active);

INSERT INTO public.billing_plans (id, name, price_per_location_cents, default_store_limit, trial_days, entitlements) VALUES
  ('starter', 'Starter', 8900, 1, 14, '{"max_employees":15,"modules":["dashboard","locations","team"]}'),
  ('growth', 'Growth', 8300, 3, 14, '{"max_employees":60,"modules":["dashboard","locations","team","reports"]}'),
  ('enterprise', 'Enterprise', 0, 50, 30, '{"max_employees":null,"modules":["*"],"custom_contract":true}');

CREATE TABLE public.subscriptions (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.billing_plans(id) DEFAULT 'starter',
  status text NOT NULL DEFAULT 'trialing',
  billed_locations integer NOT NULL DEFAULT 1,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_chk CHECK (status IN ('trialing','active','past_due','grace','unpaid','canceled','incomplete'))
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read subscription" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_org_owner(org_id));

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount_cents integer,
  currency text NOT NULL DEFAULT 'usd',
  status text,
  description text,
  stripe_ref text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read billing history" ON public.billing_events FOR SELECT TO authenticated USING (public.is_org_owner(org_id));

INSERT INTO public.subscriptions (org_id, plan_id, status, billed_locations, trial_ends_at)
SELECT o.id, o.plan, CASE WHEN o.status = 'trial' THEN 'trialing' ELSE 'active' END,
       GREATEST(1, (SELECT count(*) FROM public.locations l WHERE l.org_id = o.id AND l.status <> 'inactive')),
       CASE WHEN o.status = 'trial' THEN now() + interval '14 days' END
FROM public.organizations o ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_org_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _days int;
begin
  select trial_days into _days from public.billing_plans where id = new.plan;
  insert into public.subscriptions (org_id, plan_id, status, trial_ends_at)
    values (new.id, new.plan, 'trialing', now() + make_interval(days => coalesce(_days, 14)))
    on conflict do nothing;
  return new;
end $$;
CREATE TRIGGER organizations_subscription AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.trg_org_subscription();

-- ===== Reusable operational guard (every mutating business RPC must call it) =====
CREATE OR REPLACE FUNCTION public.org_is_operational(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.organizations o left join public.subscriptions s on s.org_id = o.id
    where o.id = _org_id and o.status <> 'suspended'
      and (s.org_id is null or s.status in ('trialing','active','past_due','grace','incomplete')));
$$;

CREATE OR REPLACE FUNCTION public.assert_org_operational(_org_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if exists (select 1 from public.organizations where id = _org_id and status = 'suspended') then raise exception 'org_suspended'; end if;
  if not public.org_is_operational(_org_id) then raise exception 'subscription_inactive'; end if;
end $$;

-- For RLS write policies on future location-scoped tables.
CREATE OR REPLACE FUNCTION public.can_operate_location(_location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.can_access_location(_location_id)
     and public.org_is_operational((select org_id from public.locations where id = _location_id))
     and coalesce((select status from public.locations where id = _location_id), 'inactive') = 'active';
$$;

CREATE OR REPLACE FUNCTION public.active_store_count(_org_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select count(*)::int from public.locations where org_id = _org_id and status <> 'inactive';
$$;

-- ===== Location RPCs =====
CREATE OR REPLACE FUNCTION public.create_location(_org_id uuid, _name text, _address text, _timezone text, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare _id uuid; _limit int;
begin
  if not public.is_org_owner(_org_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_org_id);
  if coalesce(length(trim(_name)), 0) < 2 or length(_name) > 80 then raise exception 'invalid_name'; end if;
  if not exists (select 1 from pg_timezone_names where name = _timezone) then raise exception 'invalid_timezone'; end if;
  select store_limit into _limit from public.organizations where id = _org_id for update;
  if public.active_store_count(_org_id) >= _limit then raise exception 'store_limit'; end if;
  insert into public.locations (org_id, slug, name, address, timezone, phone, status)
    values (_org_id, 'loc_' || encode(extensions.gen_random_bytes(6), 'hex'), trim(_name), nullif(trim(_address), ''), _timezone, nullif(trim(_phone), ''), 'active')
    returning id into _id;
  perform public.write_audit(_org_id, 'location.created', trim(_name), '{}'::jsonb);
  return _id;
end $$;

CREATE OR REPLACE FUNCTION public.update_location(_id uuid, _name text, _address text, _phone text, _timezone text, _hours jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _loc public.locations; _me public.organization_members;
begin
  select * into _loc from public.locations where id = _id for update;
  if _loc.id is null then raise exception 'forbidden'; end if;
  _me := public.my_member(_loc.org_id);
  if _me.id is null or _me.role = 'staff' or not public.can_access_location(_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_loc.org_id);
  if coalesce(length(trim(_name)), 0) < 2 or length(_name) > 80 then raise exception 'invalid_name'; end if;
  if not exists (select 1 from pg_timezone_names where name = _timezone) then raise exception 'invalid_timezone'; end if;
  if jsonb_typeof(coalesce(_hours, '{}')) <> 'object' then raise exception 'invalid_hours'; end if;
  update public.locations set name = trim(_name), address = nullif(trim(_address), ''), phone = nullif(trim(_phone), ''),
    timezone = _timezone, hours = coalesce(_hours, '{}'), updated_at = now(),
    -- editing the address of a verified store clears verification
    is_verified = is_verified and nullif(trim(_address), '') is not distinct from address
  where id = _id;
  perform public.write_audit(_loc.org_id, 'location.updated', trim(_name), jsonb_build_object('location_id', _id));
end $$;

CREATE OR REPLACE FUNCTION public.set_location_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _loc public.locations; _limit int;
begin
  select * into _loc from public.locations where id = _id for update;
  if _loc.id is null or not public.is_org_owner(_loc.org_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_loc.org_id);
  if _status not in ('active','inactive') then raise exception 'invalid_status'; end if;
  if _status = 'active' and _loc.status <> 'active' then
    if _loc.address is null then raise exception 'address_required'; end if;
    if _loc.status = 'inactive' then
      select store_limit into _limit from public.organizations where id = _loc.org_id for update;
      if public.active_store_count(_loc.org_id) >= _limit then raise exception 'store_limit'; end if;
    end if;
  end if;
  update public.locations set status = _status, updated_at = now() where id = _id;
  perform public.write_audit(_loc.org_id, 'location.status_changed', _loc.name, jsonb_build_object('from', _loc.status, 'to', _status));
end $$;

CREATE OR REPLACE FUNCTION public.set_location_managers(_location_id uuid, _member_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _loc public.locations;
begin
  select * into _loc from public.locations where id = _location_id;
  if _loc.id is null or not public.is_org_owner(_loc.org_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_loc.org_id);
  if exists (select 1 from unnest(coalesce(_member_ids, '{}')) x where not exists (
      select 1 from public.organization_members m where m.id = x and m.org_id = _loc.org_id and m.role = 'manager')) then
    raise exception 'invalid_member'; end if;
  delete from public.member_location_access a using public.organization_members m
    where a.member_id = m.id and m.role = 'manager' and a.location_id = _location_id and not (m.id = any(coalesce(_member_ids, '{}')));
  insert into public.member_location_access (member_id, location_id)
    select x, _location_id from unnest(coalesce(_member_ids, '{}')) x on conflict do nothing;
  perform public.write_audit(_loc.org_id, 'location.managers_changed', _loc.name, jsonb_build_object('managers', to_jsonb(coalesce(_member_ids, '{}'))));
end $$;

-- ===== Team RPCs =====
CREATE OR REPLACE FUNCTION public.set_member_role(_member_id uuid, _role public.org_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _m public.organization_members;
begin
  select * into _m from public.organization_members where id = _member_id for update;
  if _m.id is null or not public.is_org_owner(_m.org_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_m.org_id);
  update public.organization_members set role = _role where id = _member_id; -- audit + last-owner guard via trigger
end $$;

-- Can the caller manage this (non-owner) member? Owners: anyone. Managers: staff fully inside their scope.
CREATE OR REPLACE FUNCTION public.can_manage_member(_member_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare _t public.organization_members; _me public.organization_members;
begin
  select * into _t from public.organization_members where id = _member_id;
  if _t.id is null then return false; end if;
  _me := public.my_member(_t.org_id);
  if _me.id is null then return false; end if;
  if _me.role = 'owner' then return true; end if;
  if _me.role <> 'manager' or _t.role <> 'staff' then return false; end if;
  return not exists (select 1 from public.member_location_access a where a.member_id = _t.id
    and a.location_id not in (select public.member_scope(_me.id)));
end $$;

CREATE OR REPLACE FUNCTION public.set_member_locations(_member_id uuid, _location_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _t public.organization_members; _me public.organization_members;
begin
  select * into _t from public.organization_members where id = _member_id;
  if _t.id is null or _t.role = 'owner' or not public.can_manage_member(_member_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_t.org_id);
  _me := public.my_member(_t.org_id);
  if exists (select 1 from unnest(coalesce(_location_ids, '{}')) x where not exists (
      select 1 from public.locations l where l.id = x and l.org_id = _t.org_id)) then raise exception 'invalid_location'; end if;
  if _me.role = 'manager' and exists (select 1 from unnest(coalesce(_location_ids, '{}')) x
      where x not in (select public.member_scope(_me.id))) then raise exception 'forbidden'; end if;
  delete from public.member_location_access where member_id = _member_id and not (location_id = any(coalesce(_location_ids, '{}')));
  insert into public.member_location_access (member_id, location_id)
    select _member_id, x from unnest(coalesce(_location_ids, '{}')) x on conflict do nothing;
  perform public.write_audit(_t.org_id, 'member.locations_changed', _t.user_id::text, jsonb_build_object('locations', to_jsonb(coalesce(_location_ids, '{}'))));
end $$;

CREATE OR REPLACE FUNCTION public.remove_member(_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _t public.organization_members;
begin
  select * into _t from public.organization_members where id = _member_id;
  if _t.id is null then raise exception 'forbidden'; end if;
  if _t.user_id <> auth.uid() and not public.can_manage_member(_member_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_t.org_id);
  delete from public.member_location_access where member_id = _member_id;
  delete from public.organization_members where id = _member_id; -- audit + last-owner guard via trigger
end $$;

-- Invitations: managers may invite staff only, into their own stores.
DROP FUNCTION IF EXISTS public.create_invitation(uuid, text, public.org_role);
CREATE OR REPLACE FUNCTION public.create_invitation(_org_id uuid, _email text, _role public.org_role, _location_ids uuid[] DEFAULT '{}')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare _token text; _me public.organization_members;
begin
  _me := public.my_member(_org_id);
  if _me.id is null or _me.role = 'staff' then raise exception 'forbidden'; end if;
  if _me.role = 'manager' and _role <> 'staff' then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_org_id);
  if _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from unnest(coalesce(_location_ids, '{}')) x where not exists (
      select 1 from public.locations l where l.id = x and l.org_id = _org_id)) then raise exception 'invalid_location'; end if;
  if _me.role = 'manager' and exists (select 1 from unnest(coalesce(_location_ids, '{}')) x
      where x not in (select public.member_scope(_me.id))) then raise exception 'forbidden'; end if;
  _token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (org_id, email, role, token_hash, invited_by, location_ids)
    values (_org_id, lower(trim(_email)), _role, encode(extensions.digest(_token, 'sha256'), 'hex'), auth.uid(),
            case when _role = 'owner' then '{}' else coalesce(_location_ids, '{}') end);
  return _token;
end $$;
GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.org_role, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_invitation(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _inv public.invitations; _me public.organization_members;
begin
  select * into _inv from public.invitations where id = _id and accepted_at is null and revoked_at is null for update;
  if _inv.id is null then raise exception 'forbidden'; end if;
  _me := public.my_member(_inv.org_id);
  if _me.id is null or _me.role = 'staff' then raise exception 'forbidden'; end if;
  if _me.role = 'manager' and (_inv.role <> 'staff' or exists (select 1 from unnest(_inv.location_ids) x
      where x not in (select public.member_scope(_me.id)))) then raise exception 'forbidden'; end if;
  update public.invitations set revoked_at = now() where id = _id;
end $$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare _inv public.invitations; _email text; _mid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into _inv from public.invitations where token_hash = encode(extensions.digest(_token, 'sha256'), 'hex') for update;
  if _inv.id is null or _inv.revoked_at is not null or _inv.accepted_at is not null or _inv.expires_at < now() then
    raise exception 'invalid_invitation'; end if;
  select lower(email) into _email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if _email is null or _email <> _inv.email then raise exception 'email_mismatch'; end if;
  perform public.assert_org_operational(_inv.org_id);
  insert into public.organization_members (org_id, user_id, role) values (_inv.org_id, auth.uid(), _inv.role)
    on conflict (org_id, user_id) do nothing returning id into _mid;
  if _mid is not null then
    insert into public.member_location_access (member_id, location_id)
      select _mid, x from unnest(_inv.location_ids) x
      where exists (select 1 from public.locations l where l.id = x and l.org_id = _inv.org_id) on conflict do nothing;
  end if;
  update public.invitations set accepted_at = now() where id = _inv.id;
  perform public.write_audit(_inv.org_id, 'invitation.accepted', _inv.email, '{}'::jsonb);
  return _inv.org_id;
end $$;

-- ===== Admin: subscriptions =====
CREATE OR REPLACE FUNCTION public.admin_set_subscription(_org_id uuid, _plan text, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _old public.subscriptions;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  select * into _old from public.subscriptions where org_id = _org_id for update;
  if _old.org_id is null then raise exception 'not_found'; end if;
  update public.subscriptions set plan_id = coalesce(_plan, plan_id), status = coalesce(_status, status),
    grace_ends_at = case when coalesce(_status, status) = 'grace' then now() + interval '7 days' else grace_ends_at end,
    canceled_at = case when coalesce(_status, status) = 'canceled' then now() else canceled_at end,
    updated_at = now() where org_id = _org_id;
  if _plan is not null then update public.organizations set plan = _plan where id = _org_id; end if;
  perform public.write_audit(_org_id, 'billing.subscription_changed', null, jsonb_build_object('reason', _reason,
    'from', jsonb_build_object('plan', _old.plan_id, 'status', _old.status), 'to', jsonb_build_object('plan', _plan, 'status', _status)));
end $$;

-- ===== One-time first platform admin bootstrap (operator-only, never callable from the app) =====
CREATE TABLE public.platform_bootstrap (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  user_id uuid NOT NULL,
  authorization_note text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_bootstrap TO service_role;
ALTER TABLE public.platform_bootstrap ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bootstrap_first_platform_admin(_user_id uuid, _authorization_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if exists (select 1 from public.platform_bootstrap) then raise exception 'bootstrap_already_completed'; end if;
  if exists (select 1 from public.user_roles where role = 'platform_admin') then raise exception 'admin_already_exists'; end if;
  if coalesce(length(trim(_authorization_note)), 0) < 10 then raise exception 'authorization_note_required'; end if;
  if not exists (select 1 from auth.users where id = _user_id and email_confirmed_at is not null) then
    raise exception 'user_not_confirmed'; end if;
  insert into public.user_roles (user_id, role) values (_user_id, 'platform_admin');
  insert into public.platform_bootstrap (user_id, authorization_note) values (_user_id, trim(_authorization_note));
  insert into public.audit_logs (org_id, actor_id, action, target, metadata)
    values (null, null, 'platform.bootstrap_admin', _user_id::text, jsonb_build_object('note', trim(_authorization_note), 'channel', 'operator'));
end $$;

-- Lock down: no client role may execute the bootstrap or internal helpers.
REVOKE ALL ON FUNCTION public.bootstrap_first_platform_admin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_platform_admin(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.my_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.member_scope(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_org_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_location(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_location(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_location_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_location_managers(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_role(uuid, public.org_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_locations(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_subscription(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_invitation(uuid, text, public.org_role, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_location(uuid, text, text, text, text), public.update_location(uuid, text, text, text, text, jsonb),
  public.set_location_status(uuid, text), public.set_location_managers(uuid, uuid[]), public.set_member_role(uuid, public.org_role),
  public.set_member_locations(uuid, uuid[]), public.remove_member(uuid), public.admin_set_subscription(uuid, text, text, text),
  public.can_manage_member(uuid), public.is_org_owner(uuid), public.org_is_operational(uuid), public.can_operate_location(uuid),
  public.my_member(uuid), public.member_scope(uuid) TO authenticated;