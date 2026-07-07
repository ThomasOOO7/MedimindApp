-- Fix guardian notification times by formatting in Asia/Kolkata (IST)
CREATE OR REPLACE FUNCTION public.notify_guardians_on_medication_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_medication_name TEXT;
  v_patient_name TEXT;
  v_actual_time_formatted TEXT;
  v_scheduled_time_formatted TEXT;
BEGIN
  -- Validate that the medication_log belongs to an authenticated patient
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
  
  -- Format times in IST (Asia/Kolkata) for display
  IF NEW.actual_time IS NOT NULL THEN
    v_actual_time_formatted := TO_CHAR(NEW.actual_time AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM');
  ELSE
    v_actual_time_formatted := TO_CHAR(NEW.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM');
  END IF;
  
  v_scheduled_time_formatted := TO_CHAR(NEW.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM');
  
  -- Insert notifications for all active guardians
  INSERT INTO notifications (user_id, title, message, type, metadata)
  SELECT 
    gpl.guardian_id,
    CASE 
      WHEN NEW.status = 'taken' THEN '✓ Medication Taken'
      WHEN NEW.status = 'missed' THEN '⚠️ Medication Missed'
      ELSE 'Medication Update'
    END,
    v_patient_name || ' ' || 
    CASE 
      WHEN NEW.status = 'taken' THEN 'took ' || v_medication_name || ' at ' || v_actual_time_formatted
      WHEN NEW.status = 'missed' THEN 'missed ' || v_medication_name || ' scheduled for ' || v_scheduled_time_formatted
      WHEN NEW.status = 'skipped' THEN 'skipped ' || v_medication_name
      ELSE 'updated ' || v_medication_name
    END ||
    CASE
      WHEN NEW.notes IS NOT NULL THEN ' - Note: ' || NEW.notes
      ELSE ''
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
      'status', NEW.status,
      'actual_time', NEW.actual_time,
      'scheduled_time', NEW.scheduled_time,
      'notes', NEW.notes,
      'side_effects', NEW.side_effects
    )
  FROM guardian_patient_links gpl
  WHERE gpl.patient_id = NEW.patient_id 
    AND gpl.status = 'active'
    AND (gpl.permissions->>'receive_alerts')::boolean = true;
  
  RETURN NEW;
END;
$function$;