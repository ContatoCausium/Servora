create extension if not exists pgcrypto with schema extensions;

create type public.org_role as enum ('owner', 'manager', 'staff');
create type public.platform_role as enum ('platform_admin', 'support');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- Platform roles (never granted automatically)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.platform_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand_primary text not null default '#b5502f',
  brand_accent text not null default '#e0a23a',
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.locations to authenticated;
grant all on public.locations to service_role;
alter table public.locations enable row level security;

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
grant select on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

-- Location-scoped access. No rows = all locations (owners/managers); staff are limited to listed rows.
create table public.member_location_access (
  member_id uuid not null references public.organization_members(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key (member_id, location_id)
);
grant select on public.member_location_access to authenticated;
grant all on public.member_location_access to service_role;
alter table public.member_location_access enable row level security;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null default 'staff',
  token_hash text not null unique,
  invited_by uuid not null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

-- Helper functions
create or replace function public.has_platform_role(_user_id uuid, _role public.platform_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_org_member(_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = _org_id and user_id = auth.uid())
$$;

create or replace function public.can_manage_org(_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members
    where org_id = _org_id and user_id = auth.uid() and role in ('owner', 'manager'))
$$;

create or replace function public.shares_org_with(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members a
    join public.organization_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = _user_id)
$$;

-- Policies
create policy "Read own or co-member profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));
create policy "Update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "Read own platform roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid());
create policy "Members read their organizations" on public.organizations for select to authenticated
  using (public.is_org_member(id) or public.has_platform_role(auth.uid(), 'platform_admin'));
create policy "Members read org locations" on public.locations for select to authenticated
  using (public.is_org_member(org_id));
create policy "Members read org membership" on public.organization_members for select to authenticated
  using (public.is_org_member(org_id));
create policy "Members read location access" on public.member_location_access for select to authenticated
  using (exists (select 1 from public.organization_members m where m.id = member_id and public.is_org_member(m.org_id)));
create policy "Managers read invitations" on public.invitations for select to authenticated
  using (public.can_manage_org(org_id));

-- Profile on signup (no roles, no memberships)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, preferred_language)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'preferred_language')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Onboarding: create an organization owned by the caller
create or replace function public.create_organization(_name text, _brand_primary text default null, _location_name text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare _org uuid; _slug text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(length(trim(_name)), 0) < 2 or length(_name) > 80 then raise exception 'invalid_name'; end if;
  if _brand_primary is not null and _brand_primary !~ '^#[0-9a-fA-F]{6}$' then raise exception 'invalid_color'; end if;
  _slug := 'org_' || encode(extensions.gen_random_bytes(6), 'hex');
  insert into public.organizations (slug, name, brand_primary, created_by)
    values (_slug, trim(_name), coalesce(_brand_primary, '#b5502f'), auth.uid()) returning id into _org;
  insert into public.organization_members (org_id, user_id, role) values (_org, auth.uid(), 'owner');
  insert into public.locations (org_id, slug, name)
    values (_org, 'loc_' || encode(extensions.gen_random_bytes(6), 'hex'), coalesce(nullif(trim(_location_name), ''), 'Main location'));
  return _org;
end $$;

-- Invitations
create or replace function public.create_invitation(_org_id uuid, _email text, _role public.org_role)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare _token text; _caller public.org_role;
begin
  select role into _caller from public.organization_members where org_id = _org_id and user_id = auth.uid();
  if _caller is null or _caller = 'staff' then raise exception 'forbidden'; end if;
  if _role = 'owner' and _caller <> 'owner' then raise exception 'forbidden'; end if;
  if _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  _token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (org_id, email, role, token_hash, invited_by)
    values (_org_id, lower(trim(_email)), _role, encode(extensions.digest(_token, 'sha256'), 'hex'), auth.uid());
  return _token;
end $$;

create or replace function public.revoke_invitation(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.invitations set revoked_at = now()
    where id = _id and accepted_at is null and public.can_manage_org(org_id);
  if not found then raise exception 'forbidden'; end if;
end $$;

create or replace function public.get_invitation(_token text)
returns table (org_name text, org_slug text, brand_primary text, email text, role public.org_role, status text)
language sql stable security definer set search_path = public, extensions as $$
  select o.name, o.slug, o.brand_primary, i.email, i.role,
    case when i.revoked_at is not null then 'revoked'
         when i.accepted_at is not null then 'accepted'
         when i.expires_at < now() then 'expired' else 'pending' end
  from public.invitations i join public.organizations o on o.id = i.org_id
  where i.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
$$;

create or replace function public.accept_invitation(_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare _inv public.invitations; _email text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into _inv from public.invitations where token_hash = encode(extensions.digest(_token, 'sha256'), 'hex') for update;
  if _inv.id is null or _inv.revoked_at is not null or _inv.accepted_at is not null or _inv.expires_at < now() then
    raise exception 'invalid_invitation'; end if;
  select lower(email) into _email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if _email is null or _email <> _inv.email then raise exception 'email_mismatch'; end if;
  insert into public.organization_members (org_id, user_id, role) values (_inv.org_id, auth.uid(), _inv.role)
    on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = _inv.id;
  return _inv.org_id;
end $$;

revoke execute on function public.create_organization(text, text, text) from public, anon;
revoke execute on function public.create_invitation(uuid, text, public.org_role) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.org_role) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Existing tenants: present, but with no members. Access is granted only by invitation or by a platform operator.
insert into public.organizations (slug, name, brand_primary, brand_accent) values
  ('org_marao', 'MARAO BURGERS', '#d63c46', '#f2a43a'),
  ('org_harbor', 'Harbor Taco Co.', '#16707a', '#e8b64c');
insert into public.locations (org_id, slug, name)
  select id, 'loc_marao_framingham', 'MARAO Framingham' from public.organizations where slug = 'org_marao'
  union all select id, 'loc_marao_2', 'Location 2' from public.organizations where slug = 'org_marao'
  union all select id, 'loc_marao_3', 'Location 3' from public.organizations where slug = 'org_marao'
  union all select id, 'loc_harbor_1', 'Harbor Taco · Demo Store' from public.organizations where slug = 'org_harbor';