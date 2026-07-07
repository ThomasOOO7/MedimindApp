-- Create unique index on patient_code to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_patient_code_unique
ON public.profiles (patient_code)
WHERE patient_code IS NOT NULL;

-- Ensure patient_code is generated for patient profiles
DROP TRIGGER IF EXISTS set_patient_code_before_insert ON public.profiles;
CREATE TRIGGER set_patient_code_before_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_patient_code();

DROP TRIGGER IF EXISTS set_patient_code_before_update ON public.profiles;
CREATE TRIGGER set_patient_code_before_update
BEFORE UPDATE OF user_type, patient_code ON public.profiles
FOR EACH ROW
WHEN (NEW.user_type = 'patient' AND NEW.patient_code IS NULL)
EXECUTE FUNCTION public.set_patient_code();

-- Create trigger to handle link request approval to create guardian-patient link
DROP TRIGGER IF EXISTS link_request_status_change ON public.link_requests;
CREATE TRIGGER link_request_status_change
AFTER UPDATE OF status ON public.link_requests
FOR EACH ROW
WHEN (NEW.status IN ('approved','denied') AND NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.handle_link_request_approval();

-- RPC to create link request by patient code with server-side validation
CREATE OR REPLACE FUNCTION public.create_link_request_by_code(p_guardian_id uuid, p_patient_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_existing_request uuid;
  v_existing_link uuid;
  v_req_id uuid;
BEGIN
  -- Enforce caller identity
  IF auth.uid() IS NULL OR auth.uid() <> p_guardian_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER';
  END IF;

  -- Normalize and find patient by code
  SELECT id INTO v_patient_id
  FROM public.profiles
  WHERE patient_code = UPPER(TRIM(p_patient_code))
    AND user_type = 'patient';

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF v_patient_id = p_guardian_id THEN
    RAISE EXCEPTION 'CANNOT_LINK_SELF';
  END IF;

  -- Check existing active link
  SELECT id INTO v_existing_link
  FROM public.guardian_patient_links
  WHERE guardian_id = p_guardian_id
    AND patient_id = v_patient_id
    AND status = 'active';

  IF v_existing_link IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_LINKED';
  END IF;

  -- Check existing pending request
  SELECT id INTO v_existing_request
  FROM public.link_requests
  WHERE guardian_id = p_guardian_id
    AND patient_id = v_patient_id
    AND status = 'pending';

  IF v_existing_request IS NOT NULL THEN
    RETURN v_existing_request;
  END IF;

  -- Create new link request
  INSERT INTO public.link_requests (guardian_id, patient_id, status)
  VALUES (p_guardian_id, v_patient_id, 'pending')
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END;
$$;