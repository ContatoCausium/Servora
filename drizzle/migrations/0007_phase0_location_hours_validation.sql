CREATE OR REPLACE FUNCTION public.valid_location_hours(_hours jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _day text; _value jsonb;
BEGIN
  IF _hours IS NULL OR jsonb_typeof(_hours) <> 'object' THEN RETURN false; END IF;
  FOR _day, _value IN SELECT key, value FROM jsonb_each(_hours) LOOP
    IF _day NOT IN ('mon','tue','wed','thu','fri','sat','sun') THEN RETURN false; END IF;
    IF _value = 'null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(_value) <> 'object' THEN RETURN false; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(_value)) <> 2
      OR jsonb_typeof(_value->'open') IS DISTINCT FROM 'string'
      OR jsonb_typeof(_value->'close') IS DISTINCT FROM 'string'
      OR (_value->>'open') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (_value->>'close') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (_value->>'open') = (_value->>'close') THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.valid_location_hours(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valid_location_hours(jsonb) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.enforce_location_hours()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.valid_location_hours(NEW.hours) THEN RAISE EXCEPTION 'invalid_hours'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_location_hours() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_location_hours BEFORE INSERT OR UPDATE OF hours, status ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.enforce_location_hours();