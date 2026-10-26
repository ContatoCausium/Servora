ALTER TABLE public.billing_plans ADD COLUMN IF NOT EXISTS trial_store_limit integer;
UPDATE public.billing_plans SET trial_store_limit = default_store_limit WHERE trial_store_limit IS NULL;
ALTER TABLE public.billing_plans ALTER COLUMN trial_store_limit SET DEFAULT 1;
ALTER TABLE public.billing_plans ALTER COLUMN trial_store_limit SET NOT NULL;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS store_limit_override integer;
COMMENT ON COLUMN public.organizations.store_limit IS 'Derived cache of effective_store_limit(); never written directly by RPCs. Source of truth: subscription plan + store_limit_override.';
COMMENT ON COLUMN public.organizations.plan IS 'Derived cache of subscriptions.plan_id.';
-- demo tenants keep their 3 seeded stores through an explicit, documented override
UPDATE public.organizations SET store_limit_override = 3 WHERE is_demo AND store_limit_override IS NULL;

CREATE OR REPLACE FUNCTION public.effective_store_limit(_org_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(o.store_limit_override,
    case when s.status = 'trialing' then p.trial_store_limit else p.default_store_limit end, 0)
  from public.organizations o
  left join public.subscriptions s on s.org_id = o.id
  left join public.billing_plans p on p.id = coalesce(s.plan_id, o.plan)
  where o.id = _org_id;
$$;
REVOKE ALL ON FUNCTION public.effective_store_limit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.effective_store_limit(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_org_entitlements(_org_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  update public.organizations o set store_limit = public.effective_store_limit(_org_id),
    plan = coalesce((select plan_id from public.subscriptions where org_id = _org_id), o.plan)
  where o.id = _org_id;
end $$;
REVOKE ALL ON FUNCTION public.sync_org_entitlements(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_subscription_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin perform public.sync_org_entitlements(new.org_id); return new; end $$;
DROP TRIGGER IF EXISTS subscription_sync_entitlements ON public.subscriptions;
CREATE TRIGGER subscription_sync_entitlements AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_sync();

-- trial expiry and inactive statuses block operations
CREATE OR REPLACE FUNCTION public.org_is_operational(_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.organizations o left join public.subscriptions s on s.org_id = o.id
    where o.id = _org_id and o.status <> 'suspended'
      and (s.org_id is null
        or (s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()))
        or s.status in ('active','past_due','incomplete')
        or (s.status = 'grace' and (s.grace_ends_at is null or s.grace_ends_at > now()))));
$$;

CREATE OR REPLACE FUNCTION public.create_location(_org_id uuid, _name text, _address text, _timezone text, _phone text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
declare _id uuid;
begin
  if not public.is_org_owner(_org_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_org_id);
  if coalesce(length(trim(_name)), 0) < 2 or length(_name) > 80 then raise exception 'invalid_name'; end if;
  if not exists (select 1 from pg_timezone_names where name = _timezone) then raise exception 'invalid_timezone'; end if;
  perform 1 from public.organizations where id = _org_id for update;
  if public.active_store_count(_org_id) >= public.effective_store_limit(_org_id) then raise exception 'store_limit'; end if;
  insert into public.locations (org_id, slug, name, address, timezone, phone, status)
    values (_org_id, 'loc_' || encode(extensions.gen_random_bytes(6), 'hex'), trim(_name), nullif(trim(_address), ''), _timezone, nullif(trim(_phone), ''), 'active')
    returning id into _id;
  perform public.write_audit(_org_id, 'location.created', trim(_name), '{}'::jsonb);
  return _id;
end $function$;

CREATE OR REPLACE FUNCTION public.set_location_status(_id uuid, _status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _loc public.locations;
begin
  select * into _loc from public.locations where id = _id for update;
  if _loc.id is null or not public.is_org_owner(_loc.org_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_loc.org_id);
  if _status not in ('active','inactive') then raise exception 'invalid_status'; end if;
  if _status = 'active' and _loc.status <> 'active' then
    if _loc.address is null then raise exception 'address_required'; end if;
    if _loc.status = 'inactive' then
      perform 1 from public.organizations where id = _loc.org_id for update;
      if public.active_store_count(_loc.org_id) >= public.effective_store_limit(_loc.org_id) then raise exception 'store_limit'; end if;
    end if;
  end if;
  update public.locations set status = _status, updated_at = now() where id = _id;
  perform public.write_audit(_loc.org_id, 'location.status_changed', _loc.name, jsonb_build_object('from', _loc.status, 'to', _status));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_subscription(_org_id uuid, _plan text, _status text, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _old public.subscriptions;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  if _plan is not null and not exists (select 1 from public.billing_plans where id = _plan and active) then raise exception 'invalid_plan'; end if;
  if _status is not null and _status not in ('trialing','active','past_due','grace','incomplete','unpaid','canceled') then raise exception 'invalid_status'; end if;
  select * into _old from public.subscriptions where org_id = _org_id for update;
  if _old.org_id is null then raise exception 'not_found'; end if;
  update public.subscriptions set plan_id = coalesce(_plan, plan_id), status = coalesce(_status, status),
    grace_ends_at = case when coalesce(_status, status) = 'grace' then now() + interval '7 days' else grace_ends_at end,
    canceled_at = case when coalesce(_status, status) = 'canceled' then now() else canceled_at end,
    updated_at = now() where org_id = _org_id;
  perform public.write_audit(_org_id, 'billing.subscription_changed', null, jsonb_build_object('reason', _reason,
    'from', jsonb_build_object('plan', _old.plan_id, 'status', _old.status), 'to', jsonb_build_object('plan', _plan, 'status', _status)));
end $function$;

-- _plan routes through the subscription; _store_limit becomes an explicit override (0 or negative clears it)
CREATE OR REPLACE FUNCTION public.admin_update_organization(_org_id uuid, _status text, _plan text, _store_limit integer, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _old public.organizations;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  if _status is not null and _status not in ('trial','active','suspended') then raise exception 'invalid_status'; end if;
  if _plan is not null and not exists (select 1 from public.billing_plans where id = _plan and active) then raise exception 'invalid_plan'; end if;
  if _store_limit is not null and _store_limit > 500 then raise exception 'invalid_limit'; end if;
  select * into _old from public.organizations where id = _org_id for update;
  if _old.id is null then raise exception 'not_found'; end if;
  update public.organizations set status = coalesce(_status, status),
    store_limit_override = case when _store_limit is null then store_limit_override when _store_limit <= 0 then null else _store_limit end,
    suspended_reason = case when coalesce(_status, status) = 'suspended' then _reason else null end
  where id = _org_id;
  if _plan is not null then update public.subscriptions set plan_id = _plan, updated_at = now() where org_id = _org_id; end if;
  perform public.sync_org_entitlements(_org_id);
  perform public.write_audit(_org_id, 'platform.organization_updated', _old.name, jsonb_build_object(
    'reason', _reason, 'from', jsonb_build_object('status', _old.status, 'plan', _old.plan, 'store_limit', _old.store_limit, 'override', _old.store_limit_override),
    'to', jsonb_build_object('status', _status, 'plan', _plan, 'store_limit_override', _store_limit, 'effective', public.effective_store_limit(_org_id))));
end $function$;

-- admin list shows the override so operators see where the limit comes from
-- Stripe webhook idempotency ledger (service role only)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  org_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);
GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Applies a verified Stripe subscription state. Called only by the server webhook after signature verification.
CREATE OR REPLACE FUNCTION public.billing_apply_stripe_event(_event_id text, _type text, _org_id uuid, _customer text,
  _subscription text, _status text, _plan text, _period_start timestamptz, _period_end timestamptz,
  _cancel_at_period_end boolean, _amount_cents integer, _currency text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _mapped text;
begin
  insert into public.stripe_webhook_events (id, type, org_id) values (_event_id, _type, _org_id) on conflict (id) do nothing;
  if not found then return false; end if; -- duplicate delivery: no-op
  if not exists (select 1 from public.subscriptions where org_id = _org_id) then raise exception 'unknown_org'; end if;
  _mapped := case _status when 'trialing' then 'trialing' when 'active' then 'active' when 'past_due' then 'past_due'
    when 'incomplete' then 'incomplete' when 'unpaid' then 'unpaid' when 'canceled' then 'canceled'
    when 'incomplete_expired' then 'canceled' else null end;
  update public.subscriptions set
    stripe_customer_id = coalesce(_customer, stripe_customer_id),
    stripe_subscription_id = coalesce(_subscription, stripe_subscription_id),
    plan_id = coalesce((select id from public.billing_plans where id = _plan), plan_id),
    status = case when _mapped = 'past_due' and status not in ('past_due','grace') then 'grace' else coalesce(_mapped, status) end,
    grace_ends_at = case when _mapped = 'past_due' and status not in ('past_due','grace') then now() + interval '7 days'
                         when _mapped = 'active' then null else grace_ends_at end,
    current_period_start = coalesce(_period_start, current_period_start),
    current_period_end = coalesce(_period_end, current_period_end),
    cancel_at_period_end = coalesce(_cancel_at_period_end, cancel_at_period_end),
    canceled_at = case when _mapped = 'canceled' then now() else canceled_at end,
    updated_at = now()
  where org_id = _org_id;
  if _amount_cents is not null then
    insert into public.billing_events (org_id, kind, amount_cents, currency, status, description, stripe_ref)
    values (_org_id, _type, _amount_cents, coalesce(_currency, 'usd'), _status, _type, _event_id);
  end if;
  update public.stripe_webhook_events set processed_at = now() where id = _event_id;
  perform public.write_audit(_org_id, 'billing.stripe_event', _type, jsonb_build_object('event', _event_id, 'status', _status));
  return true;
end $$;
REVOKE ALL ON FUNCTION public.billing_apply_stripe_event(text,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,integer,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_apply_stripe_event(text,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,integer,text) TO service_role;

SELECT public.sync_org_entitlements(id) FROM public.organizations;