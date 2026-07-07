-- Fix notification INSERT policy to prevent unauthorized direct insertions
-- Only database triggers should be able to create notifications

DROP POLICY IF EXISTS "System can create notifications for users" ON notifications;

-- Create a restrictive policy that prevents direct inserts from users
-- The trigger function (notify_guardians_on_medication_log) runs with SECURITY DEFINER
-- so it can bypass this policy
CREATE POLICY "Only database triggers can create notifications" 
ON notifications 
FOR INSERT 
WITH CHECK (false);

-- Add validation to the trigger function to ensure data integrity
CREATE OR REPLACE FUNCTION public.notify_guardians_on_medication_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_medication_name TEXT;
  v_patient_name TEXT;
BEGIN
  -- Validate that the medication_log belongs to an authenticated patient
  -- This prevents unauthorized trigger execution
  IF NOT EXISTS (
    SELECT 1 FROM medications m
    WHERE m.id = NEW.medication_id
    AND m.patient_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Invalid medication log: medication does not belong to patient';
  END IF;
  
  -- Get medication and patient names
  SELECT m.name INTO v_medication_name
  FROM medications m
  WHERE m.id = NEW.medication_id;
  
  SELECT (p.first_name || ' ' || p.last_name) INTO v_patient_name
  FROM profiles p
  WHERE p.id = NEW.patient_id;
  
  -- Insert notifications for all active guardians
  INSERT INTO notifications (user_id, title, message, type, metadata)
  SELECT 
    gpl.guardian_id,
    CASE 
      WHEN NEW.status = 'taken' THEN 'Medication Taken'
      WHEN NEW.status = 'missed' THEN 'Medication Missed'
      ELSE 'Medication Update'
    END,
    v_patient_name || ' ' || 
    CASE 
      WHEN NEW.status = 'taken' THEN 'took ' || v_medication_name || ' at ' || TO_CHAR(NEW.actual_time, 'HH12:MI AM')
      WHEN NEW.status = 'missed' THEN 'missed ' || v_medication_name || ' scheduled for ' || TO_CHAR(NEW.scheduled_time, 'HH12:MI AM')
      WHEN NEW.status = 'skipped' THEN 'skipped ' || v_medication_name
      ELSE 'updated ' || v_medication_name
    END,
    CASE 
      WHEN NEW.status = 'taken' THEN 'medication_confirmation'
      WHEN NEW.status = 'missed' THEN 'missed_dose'
      ELSE 'medication_update'
    END,
    jsonb_build_object(
      'patient_id', NEW.patient_id,
      'medication_id', NEW.medication_id,
      'log_id', NEW.id,
      'status', NEW.status
    )
  FROM guardian_patient_links gpl
  WHERE gpl.patient_id = NEW.patient_id 
    AND gpl.status = 'active'
    AND (gpl.permissions->>'receive_alerts')::boolean = true;
  
  RETURN NEW;
END;
$$;