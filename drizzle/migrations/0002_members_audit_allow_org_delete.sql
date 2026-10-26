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
    -- Organization itself is being deleted (cascade): nothing to protect.
    if not exists (select 1 from public.organizations where id = old.org_id) then return old; end if;
    if old.role = 'owner' and not exists (
      select 1 from public.organization_members where org_id = old.org_id and role = 'owner' and id <> old.id) then
      raise exception 'last_owner';
    end if;
    perform public.write_audit(old.org_id, 'member.removed', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
end $$;