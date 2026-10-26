create or replace function public.admin_org_insights()
returns table(
  id uuid, name text, status text, plan text, is_demo boolean, created_at timestamptz,
  store_count bigint, active_store_count bigint, store_limit integer, has_override boolean,
  member_count bigint, owner_count bigint, owner_email text, pending_invites bigint,
  brand_customized boolean, sub_status text, trial_ends_at timestamptz, billed_locations integer,
  billing_connected boolean, last_activity timestamptz
)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  return query select o.id, o.name, o.status, o.plan, o.is_demo, o.created_at,
    (select count(*) from public.locations l where l.org_id = o.id),
    (select count(*) from public.locations l where l.org_id = o.id and l.status = 'active'),
    public.effective_store_limit(o.id),
    o.store_limit_override is not null,
    (select count(*) from public.organization_members m where m.org_id = o.id),
    (select count(*) from public.organization_members m where m.org_id = o.id and m.role = 'owner'),
    (select u.email::text from public.organization_members m join auth.users u on u.id = m.user_id
       where m.org_id = o.id and m.role = 'owner' order by m.created_at limit 1),
    (select count(*) from public.invitations i where i.org_id = o.id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()),
    (o.brand_primary <> '#b5502f'),
    s.status, s.trial_ends_at, s.billed_locations,
    (s.stripe_subscription_id is not null),
    (select max(a.created_at) from public.audit_logs a where a.org_id = o.id)
  from public.organizations o
  left join public.subscriptions s on s.org_id = o.id
  order by o.created_at;
end $$;
revoke all on function public.admin_org_insights() from public, anon;
grant execute on function public.admin_org_insights() to authenticated;