-- Add patient_code column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS patient_code TEXT UNIQUE;

-- Create function to generate unique 6-character patient code
CREATE OR REPLACE FUNCTION generate_patient_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 6-character alphanumeric code
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE patient_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Update existing profiles to have patient codes (only for patients)
UPDATE public.profiles 
SET patient_code = generate_patient_code()
WHERE patient_code IS NULL AND user_type = 'patient';

-- Create trigger to auto-generate patient code for new patient profiles
CREATE OR REPLACE FUNCTION set_patient_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_type = 'patient' AND NEW.patient_code IS NULL THEN
    NEW.patient_code := generate_patient_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_patient_code_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION set_patient_code();

-- Create link_requests table for guardian-patient link requests
CREATE TABLE IF NOT EXISTS public.link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guardian_id, patient_id)
);

-- Enable RLS on link_requests
ALTER TABLE public.link_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for link_requests
CREATE POLICY "Guardians can create link requests"
ON public.link_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = guardian_id);

CREATE POLICY "Users can view their own link requests"
ON public.link_requests
FOR SELECT
TO authenticated
USING (auth.uid() = guardian_id OR auth.uid() = patient_id);

CREATE POLICY "Patients can update requests for themselves"
ON public.link_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can delete their own link requests"
ON public.link_requests
FOR DELETE
TO authenticated
USING (auth.uid() = guardian_id OR auth.uid() = patient_id);

-- Create function to handle approved link requests
CREATE OR REPLACE FUNCTION handle_link_request_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a link request is approved, create the guardian-patient link
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    INSERT INTO public.guardian_patient_links (guardian_id, patient_id, status)
    VALUES (NEW.guardian_id, NEW.patient_id, 'active')
    ON CONFLICT (guardian_id, patient_id) DO NOTHING;
    
    -- Create notification for guardian
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.guardian_id,
      'Link Request Approved',
      'Your link request has been approved. You can now monitor this patient.',
      'link_approved',
      jsonb_build_object('patient_id', NEW.patient_id, 'request_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER link_request_approval_trigger
AFTER UPDATE ON public.link_requests
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION handle_link_request_approval();

-- Enable realtime for link_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.link_requests;

-- Add updated_at trigger
CREATE TRIGGER update_link_requests_updated_at
BEFORE UPDATE ON public.link_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();