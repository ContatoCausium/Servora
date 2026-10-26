alter table public.organizations
  add column if not exists status text not null default 'active',
  add column if not exists plan text not null default 'starter',
  add column if not exists store_limit integer not null default 3,
  add column if not exists suspended_reason text,
  add column if not exists is_demo boolean not null default false;
update public.organizations set is_demo = true where created_by is null;
alter table public.organizations add constraint organizations_status_chk check (status in ('trial','active','suspended'));
alter table public.organizations add constraint organizations_plan_chk check (plan in ('starter','growth','enterprise'));
alter table public.organizations add constraint organizations_store_limit_chk check (store_limit between 1 and 500);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  actor_id uuid,
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs(org_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

create or replace function public.write_audit(_org uuid, _action text, _target text, _meta jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (org_id, actor_id, action, target, metadata)
  values (_org, auth.uid(), _action, _target, coalesce(_meta, '{}'::jsonb));
$$;
revoke execute on function public.write_audit(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(auth.uid(), 'platform_admin');
$$;

create policy "Org managers read org audit" on public.audit_logs for select to authenticated
  using (org_id is not null and public.can_manage_org(org_id));
create policy "Platform admins read all audit" on public.audit_logs for select to authenticated
  using (public.is_platform_admin());

create or replace function public.trg_members_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.org_id, 'member.added', new.user_id::text, jsonb_build_object('role', new.role));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      if old.role = 'owner' and new.role <> 'owner' and not exists (
        select 1 from public.organization_members where org_id = old.org_id and role = 'owner' and id <> old.id) then
        raise exception 'last_owner';
      end if;
      perform public.write_audit(new.org_id, 'member.role_changed', new.user_id::text, jsonb_build_object('from', old.role, 'to', new.role));
    end if;
    return new;
  else
    if old.role = 'owner' and not exists (
      select 1 from public.organization_members where org_id = old.org_id and role = 'owner' and id <> old.id) then
      raise exception 'last_owner';
    end if;
    perform public.write_audit(old.org_id, 'member.removed', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
end $$;
create trigger members_audit after insert or update or delete on public.organization_members
  for each row execute function public.trg_members_audit();

create or replace function public.trg_invitations_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.org_id, 'invitation.created', new.email, jsonb_build_object('role', new.role));
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform public.write_audit(new.org_id, 'invitation.revoked', new.email, '{}'::jsonb);
  elsif new.accepted_at is not null and old.accepted_at is null then
    perform public.write_audit(new.org_id, 'invitation.accepted', new.email, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger invitations_audit after insert or update on public.invitations
  for each row execute function public.trg_invitations_audit();

create or replace function public.can_access_location(_location_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.locations l
    join public.organization_members m on m.org_id = l.org_id and m.user_id = auth.uid()
    where l.id = _location_id
      and (m.role in ('owner','manager')
           or exists (select 1 from public.member_location_access a where a.member_id = m.id and a.location_id = l.id)));
$$;
drop policy "Members read org locations" on public.locations;
create policy "Members read accessible locations" on public.locations for select to authenticated
  using (public.can_access_location(id));

drop policy "Members read their organizations" on public.organizations;
create policy "Members read their organizations" on public.organizations for select to authenticated
  using (public.is_org_member(id));

create or replace function public.create_organization(_name text, _brand_primary text default null, _location_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _org uuid; _slug text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(length(trim(_name)), 0) < 2 or length(_name) > 80 then raise exception 'invalid_name'; end if;
  if _brand_primary is not null and _brand_primary !~ '^#[0-9a-fA-F]{6}$' then raise exception 'invalid_color'; end if;
  if (select count(*) from public.organizations where created_by = auth.uid()) >= 3 then raise exception 'org_limit'; end if;
  _slug := 'org_' || encode(extensions.gen_random_bytes(6), 'hex');
  insert into public.organizations (slug, name, brand_primary, created_by, status)
    values (_slug, trim(_name), coalesce(_brand_primary, '#b5502f'), auth.uid(), 'trial') returning id into _org;
  insert into public.organization_members (org_id, user_id, role) values (_org, auth.uid(), 'owner');
  insert into public.locations (org_id, slug, name)
    values (_org, 'loc_' || encode(extensions.gen_random_bytes(6), 'hex'), coalesce(nullif(trim(_location_name), ''), 'Main location'));
  perform public.write_audit(_org, 'organization.created', trim(_name), '{}'::jsonb);
  return _org;
end $$;

create or replace function public.transfer_ownership(_org_id uuid, _new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.organization_members where org_id = _org_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'forbidden'; end if;
  if not exists (select 1 from public.organization_members where org_id = _org_id and user_id = _new_owner) then
    raise exception 'not_member'; end if;
  update public.organization_members set role = 'owner' where org_id = _org_id and user_id = _new_owner;
  update public.organization_members set role = 'manager' where org_id = _org_id and user_id = auth.uid() and _new_owner <> auth.uid();
  perform public.write_audit(_org_id, 'ownership.transferred', _new_owner::text, '{}'::jsonb);
end $$;

create or replace function public.admin_list_organizations()
returns table(id uuid, name text, slug text, status text, plan text, store_limit int, store_count bigint,
              member_count bigint, owner_count bigint, is_demo boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  return query select o.id, o.name, o.slug, o.status, o.plan, o.store_limit,
    (select count(*) from public.locations l where l.org_id = o.id),
    (select count(*) from public.organization_members m where m.org_id = o.id),
    (select count(*) from public.organization_members m where m.org_id = o.id and m.role = 'owner'),
    o.is_demo, o.created_at
  from public.organizations o order by o.created_at;
end $$;

create or replace function public.admin_update_organization(_org_id uuid, _status text, _plan text, _store_limit int, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _old public.organizations;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  select * into _old from public.organizations where id = _org_id for update;
  if _old.id is null then raise exception 'not_found'; end if;
  update public.organizations set status = coalesce(_status, status), plan = coalesce(_plan, plan),
    store_limit = coalesce(_store_limit, store_limit),
    suspended_reason = case when coalesce(_status, status) = 'suspended' then _reason else null end
  where id = _org_id;
  perform public.write_audit(_org_id, 'platform.organization_updated', _old.name, jsonb_build_object(
    'reason', _reason, 'from', jsonb_build_object('status', _old.status, 'plan', _old.plan, 'store_limit', _old.store_limit),
    'to', jsonb_build_object('status', _status, 'plan', _plan, 'store_limit', _store_limit)));
end $$;

create or replace function public.admin_assign_owner(_org_id uuid, _email text, _verification_note text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(_verification_note)), 0) < 10 then raise exception 'verification_required'; end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email)) and email_confirmed_at is not null;
  if _uid is null then raise exception 'user_not_found'; end if;
  insert into public.organization_members (org_id, user_id, role) values (_org_id, _uid, 'owner')
    on conflict (org_id, user_id) do update set role = 'owner';
  perform public.write_audit(_org_id, 'platform.owner_assigned', lower(trim(_email)), jsonb_build_object('verification', _verification_note));
end $$;

create or replace function public.admin_list_audit(_limit int default 100)
returns table(id uuid, org_id uuid, org_name text, actor_id uuid, action text, target text, metadata jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  return query select a.id, a.org_id, o.name, a.actor_id, a.action, a.target, a.metadata, a.created_at
  from public.audit_logs a left join public.organizations o on o.id = a.org_id
  order by a.created_at desc limit least(greatest(_limit, 1), 500);
end $$;

create or replace function public.admin_list_platform_admins()
returns table(user_id uuid, email text, role public.platform_role)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  return query select r.user_id, u.email::text, r.role from public.user_roles r join auth.users u on u.id = r.user_id;
end $$;

create or replace function public.admin_set_platform_role(_email text, _role public.platform_role, _grant boolean, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email)) and email_confirmed_at is not null;
  if _uid is null then raise exception 'user_not_found'; end if;
  if _grant then
    insert into public.user_roles (user_id, role) values (_uid, _role) on conflict do nothing;
  else
    if _role = 'platform_admin' and (select count(*) from public.user_roles where role = 'platform_admin' and user_id <> _uid) = 0 then
      raise exception 'last_admin'; end if;
    delete from public.user_roles where user_id = _uid and role = _role;
  end if;
  perform public.write_audit(null, case when _grant then 'platform.role_granted' else 'platform.role_revoked' end,
    lower(trim(_email)), jsonb_build_object('role', _role, 'reason', _reason));
end $$;

create or replace function public.my_org_status(_org_id uuid)
returns table(status text, plan text, store_limit int, suspended_reason text)
language sql stable security definer set search_path = public as $$
  select o.status, o.plan, o.store_limit, o.suspended_reason from public.organizations o
  where o.id = _org_id and public.is_org_member(o.id);
$$;

revoke execute on function public.admin_list_organizations(), public.admin_update_organization(uuid,text,text,int,text),
  public.admin_assign_owner(uuid,text,text), public.admin_list_audit(int), public.admin_list_platform_admins(),
  public.admin_set_platform_role(text,public.platform_role,boolean,text), public.transfer_ownership(uuid,uuid),
  public.my_org_status(uuid), public.is_platform_admin(), public.can_access_location(uuid) from public, anon;
grant execute on function public.admin_list_organizations(), public.admin_update_organization(uuid,text,text,int,text),
  public.admin_assign_owner(uuid,text,text), public.admin_list_audit(int), public.admin_list_platform_admins(),
  public.admin_set_platform_role(text,public.platform_role,boolean,text), public.transfer_ownership(uuid,uuid),
  public.my_org_status(uuid), public.is_platform_admin(), public.can_access_location(uuid) to authenticated;
