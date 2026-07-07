-- Add dose_times array column to medications table for multiple daily doses
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS dose_times TIME[] DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.medications.dose_times IS 'Array of time values for multiple daily doses. When null, falls back to single time field for backward compatibility.';

-- Update get_todays_schedule function to support multiple dose times
CREATE OR REPLACE FUNCTION public.get_todays_schedule(p_patient_id uuid)
RETURNS TABLE(
  medication_id uuid, 
  medication_name text, 
  dosage text, 
  unit medication_unit, 
  scheduled_time time without time zone, 
  status log_status, 
  image_url text, 
  instructions text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH expanded_times AS (
    -- Expand medications with dose_times array
    SELECT 
      m.id AS medication_id,
      m.name AS medication_name,
      m.dosage,
      m.unit,
      UNNEST(
        CASE 
          WHEN m.dose_times IS NOT NULL AND array_length(m.dose_times, 1) > 0 
          THEN m.dose_times 
          ELSE ARRAY[m.time]
        END
      ) AS scheduled_time,
      m.image_url,
      m.instructions
    FROM medications m
    WHERE m.patient_id = p_patient_id
      AND m.is_active = true
      AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
  )
  SELECT 
    et.medication_id,
    et.medication_name,
    et.dosage,
    et.unit,
    et.scheduled_time,
    COALESCE(
      (
        SELECT ml.status 
        FROM medication_logs ml
        WHERE ml.medication_id = et.medication_id
          AND ml.scheduled_time::date = CURRENT_DATE
          AND ml.scheduled_time::time = et.scheduled_time
        ORDER BY ml.created_at DESC
        LIMIT 1
      ),
      'missed'::log_status
    ) AS status,
    et.image_url,
    et.instructions
  FROM expanded_times et
  ORDER BY et.scheduled_time;
END;
$function$;

-- Update send_medication_reminders function to handle multiple dose times
CREATE OR REPLACE FUNCTION public.send_medication_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create notifications for medications with single time field
  INSERT INTO notifications (user_id, title, message, type, metadata)
  SELECT 
    m.patient_id,
    'Medication Reminder',
    'Time to take ' || m.name || ' (' || m.dosage || ' ' || m.unit || ')',
    'medication_reminder',
    jsonb_build_object(
      'medication_id', m.id,
      'scheduled_time', m.time
    )
  FROM medications m
  WHERE m.is_active = true
    AND m.dose_times IS NULL
    AND m.time::time >= (NOW() + INTERVAL '25 minutes')::time
    AND m.time::time <= (NOW() + INTERVAL '35 minutes')::time
    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.patient_id
        AND n.type = 'medication_reminder'
        AND n.metadata->>'medication_id' = m.id::text
        AND n.created_at > NOW() - INTERVAL '1 hour'
    );
    
  -- Create notifications for medications with dose_times array
  INSERT INTO notifications (user_id, title, message, type, metadata)
  SELECT 
    m.patient_id,
    'Medication Reminder',
    'Time to take ' || m.name || ' (' || m.dosage || ' ' || m.unit || ')',
    'medication_reminder',
    jsonb_build_object(
      'medication_id', m.id,
      'scheduled_time', dose_time
    )
  FROM medications m
  CROSS JOIN UNNEST(m.dose_times) AS dose_time
  WHERE m.is_active = true
    AND m.dose_times IS NOT NULL
    AND dose_time >= (NOW() + INTERVAL '25 minutes')::time
    AND dose_time <= (NOW() + INTERVAL '35 minutes')::time
    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.patient_id
        AND n.type = 'medication_reminder'
        AND n.metadata->>'medication_id' = m.id::text
        AND n.metadata->>'scheduled_time' = dose_time::text
        AND n.created_at > NOW() - INTERVAL '1 hour'
    );
END;
$function$;