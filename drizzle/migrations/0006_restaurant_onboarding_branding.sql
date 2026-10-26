ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text, ADD COLUMN IF NOT EXISTS previous_brand jsonb, ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS company_address text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 5;
CREATE OR REPLACE FUNCTION public.create_test_restaurant(_name text, _company_name text, _company_address text, _location_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
 IF length(coalesce(_company_name,'')) > 120 OR length(coalesce(_company_address,'')) > 240 THEN RAISE EXCEPTION 'invalid_name'; END IF;
 _org := public.create_organization(_name, null, _location_name);
 UPDATE public.organizations SET is_demo=true, company_name=trim(_company_name), company_address=trim(_company_address), onboarding_step=0 WHERE id=_org;
 PERFORM public.write_audit(_org,'organization.test_classified',_name,'{}'::jsonb);
 RETURN _org;
END $$;
REVOKE ALL ON FUNCTION public.create_test_restaurant(text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_test_restaurant(text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_org_brand(_org_id uuid, _primary text, _accent text, _logo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE org_id=_org_id AND user_id=auth.uid() AND role='owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM public.assert_org_operational(_org_id);
 IF _primary !~ '^#[0-9a-fA-F]{6}$' OR _accent !~ '^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION 'invalid_color'; END IF;
 IF _logo IS NOT NULL AND (length(_logo)>2800000 OR _logo !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') THEN RAISE EXCEPTION 'invalid_logo'; END IF;
 UPDATE public.organizations SET previous_brand=jsonb_build_object('primary',brand_primary,'accent',brand_accent,'logoUrl',logo_url), brand_primary=_primary, brand_accent=_accent, logo_url=_logo WHERE id=_org_id;
 PERFORM public.write_audit(_org_id,'organization.brand_updated',null,jsonb_build_object('primary',_primary,'accent',_accent,'has_logo',_logo IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.save_org_brand(uuid,text,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.save_org_brand(uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_onboarding_step(_org_id uuid,_step integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE org_id=_org_id AND user_id=auth.uid() AND role='owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM public.assert_org_operational(_org_id);
 IF _step < 0 OR _step > 5 THEN RAISE EXCEPTION 'invalid_step'; END IF;
 UPDATE public.organizations SET onboarding_step=_step WHERE id=_org_id;
 PERFORM public.write_audit(_org_id,'organization.onboarding_progress',null,jsonb_build_object('step',_step));
END $$;
REVOKE ALL ON FUNCTION public.set_onboarding_step(uuid,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_onboarding_step(uuid,integer) TO authenticated;