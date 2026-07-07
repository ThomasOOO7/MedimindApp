-- Update send_medication_reminders to fire exactly at scheduled times (±1 minute)
CREATE OR REPLACE FUNCTION public.send_medication_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create notifications for medications with single time field within the last minute
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
    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    AND m.time::time >= (NOW() - INTERVAL '1 minute')::time
    AND m.time::time <= NOW()::time
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.patient_id
        AND n.type = 'medication_reminder'
        AND n.metadata->>'medication_id' = m.id::text
        AND n.created_at > NOW() - INTERVAL '10 minutes'
    );
    
  -- Create notifications for medications with dose_times array within the last minute
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
    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    AND dose_time >= (NOW() - INTERVAL '1 minute')::time
    AND dose_time <= NOW()::time
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.patient_id
        AND n.type = 'medication_reminder'
        AND n.metadata->>'medication_id' = m.id::text
        AND n.metadata->>'scheduled_time' = dose_time::text
        AND n.created_at > NOW() - INTERVAL '10 minutes'
    );
END;
$$;