CREATE OR REPLACE FUNCTION public.set_onboarding_step(_org_id uuid,_step integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _brand boolean; _store boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE org_id=_org_id AND user_id=auth.uid() AND role='owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM public.assert_org_operational(_org_id);
 IF _step < 0 OR _step > 5 THEN RAISE EXCEPTION 'invalid_step'; END IF;
 -- Required steps must be backed by persisted data: branding (step 0) and a configured store (step 2).
 SELECT (logo_url IS NOT NULL OR previous_brand IS NOT NULL) INTO _brand FROM public.organizations WHERE id=_org_id;
 SELECT EXISTS(SELECT 1 FROM public.locations l WHERE l.org_id=_org_id AND coalesce(btrim(l.address),'')<>''
   AND EXISTS(SELECT 1 FROM jsonb_each(l.hours) h WHERE jsonb_typeof(h.value)='object')) INTO _store;
 IF _step > 0 AND NOT coalesce(_brand,false) THEN RAISE EXCEPTION 'onboarding_brand_required'; END IF;
 IF _step > 2 AND NOT _store THEN RAISE EXCEPTION 'onboarding_store_required'; END IF;
 UPDATE public.organizations SET onboarding_step=_step WHERE id=_org_id;
 PERFORM public.write_audit(_org_id,'organization.onboarding_progress',null,jsonb_build_object('step',_step));
END $$;