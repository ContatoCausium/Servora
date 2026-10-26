CREATE OR REPLACE FUNCTION public.save_location_with_managers(_id uuid, _name text, _address text, _phone text, _timezone text, _hours jsonb, _member_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  -- Both calls keep their own authorization and audit checks; one function = one transaction,
  -- so a manager-assignment failure rolls back the detail update too.
  perform public.update_location(_id, _name, _address, _phone, _timezone, _hours);
  if _member_ids is not null then
    perform public.set_location_managers(_id, _member_ids);
  end if;
end $$;
REVOKE ALL ON FUNCTION public.save_location_with_managers(uuid, text, text, text, text, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_location_with_managers(uuid, text, text, text, text, jsonb, uuid[]) TO authenticated;