# Authorization pattern for business modules

Every operational table (orders, menu, inventory, shifts, …) must follow this pattern.

## Table shape
- `org_id uuid not null references organizations(id)`
- `location_id uuid references locations(id)` when the data belongs to a store
- No client INSERT/UPDATE/DELETE policies. Writes go through security-definer RPCs.

## Reads (RLS)
```sql
-- location-scoped
create policy "read scoped" on public.<t> for select to authenticated
  using (public.can_access_location(location_id));
-- org-wide (owner-level data)
create policy "read org" on public.<t> for select to authenticated
  using (public.is_org_owner(org_id));
```

## Writes (RPC template)
```sql
create function public.<module>_<action>(_location_id uuid, ...) returns ... language plpgsql
security definer set search_path = public as $$
declare _org uuid := (select org_id from public.locations where id = _location_id);
begin
  if not public.can_access_location(_location_id) then raise exception 'forbidden'; end if;
  perform public.assert_org_operational(_org);          -- blocks suspended / inactive subscriptions
  -- role check if needed: (public.my_member(_org)).role in ('owner','manager')
  ...
  perform public.write_audit(_org, '<module>.<action>', <target>, <meta>);
end $$;
revoke all on function public.<module>_<action>(...) from public, anon;
grant execute on function public.<module>_<action>(...) to authenticated;
```
If a write policy is ever unavoidable, use `public.can_operate_location(location_id)` — it combines
store access, an operational organization and an active store.

## Helpers
| Helper | Meaning |
|---|---|
| `is_org_member(org)` | caller belongs to org |
| `is_org_owner(org)` | caller is an owner |
| `can_manage_org(org)` | owner or manager |
| `can_access_location(loc)` | owner, or member assigned to the store |
| `member_scope(member)` | stores a member covers |
| `can_manage_member(member)` | owner, or manager over staff inside their stores |
| `org_is_operational(org)` / `assert_org_operational(org)` | not suspended, subscription usable |
| `can_operate_location(loc)` | access + operational + store active |

Add the module's attack cases to `scripts/security/` and re-run both scripts.
