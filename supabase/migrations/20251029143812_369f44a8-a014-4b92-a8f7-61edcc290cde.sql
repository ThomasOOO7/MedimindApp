-- Create function to get today's medication schedule for a patient
CREATE OR REPLACE FUNCTION public.get_todays_schedule(p_patient_id UUID)
RETURNS TABLE (
  medication_id UUID,
  medication_name TEXT,
  dosage TEXT,
  unit medication_unit,
  scheduled_time TIME,
  status log_status,
  image_url TEXT,
  instructions TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS medication_id,
    m.name AS medication_name,
    m.dosage,
    m.unit,
    m.time AS scheduled_time,
    COALESCE(ml.status, 'missed'::log_status) AS status,
    m.image_url,
    m.instructions
  FROM medications m
  LEFT JOIN medication_logs ml ON 
    ml.medication_id = m.id 
    AND DATE(ml.scheduled_time) = CURRENT_DATE
  WHERE m.patient_id = p_patient_id
    AND m.is_active = true
    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
  ORDER BY m.time;
END;
$$;

-- Create function to log medication taken
CREATE OR REPLACE FUNCTION public.log_medication_taken(
  p_medication_id UUID,
  p_patient_id UUID,
  p_scheduled_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_actual_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_notes TEXT DEFAULT NULL,
  p_side_effects TEXT DEFAULT NULL,
  p_effectiveness_rating INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO medication_logs (
    medication_id,
    patient_id,
    scheduled_time,
    actual_time,
    status,
    notes,
    side_effects,
    effectiveness_rating
  )
  VALUES (
    p_medication_id,
    p_patient_id,
    p_scheduled_time,
    p_actual_time,
    'taken'::log_status,
    p_notes,
    p_side_effects,
    p_effectiveness_rating
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create function to get medication history
CREATE OR REPLACE FUNCTION public.get_medication_history(
  p_patient_id UUID,
  p_medication_id UUID DEFAULT NULL,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  log_id UUID,
  medication_name TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  actual_time TIMESTAMP WITH TIME ZONE,
  status log_status,
  notes TEXT,
  side_effects TEXT,
  effectiveness_rating INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ml.id AS log_id,
    m.name AS medication_name,
    ml.scheduled_time,
    ml.actual_time,
    ml.status,
    ml.notes,
    ml.side_effects,
    ml.effectiveness_rating
  FROM medication_logs ml
  JOIN medications m ON m.id = ml.medication_id
  WHERE ml.patient_id = p_patient_id
    AND (p_medication_id IS NULL OR ml.medication_id = p_medication_id)
    AND ml.scheduled_time >= (CURRENT_TIMESTAMP - (p_days_back || ' days')::INTERVAL)
  ORDER BY ml.scheduled_time DESC;
END;
$$;

-- Create trigger function to notify guardians when medication is logged
CREATE OR REPLACE FUNCTION public.notify_guardians_on_medication_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medication_name TEXT;
  v_patient_name TEXT;
BEGIN
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

-- Create trigger for medication log notifications
DROP TRIGGER IF EXISTS on_medication_log_created ON medication_logs;
CREATE TRIGGER on_medication_log_created
  AFTER INSERT ON medication_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_guardians_on_medication_log();

-- Create function to get guardian's patients summary
CREATE OR REPLACE FUNCTION public.get_guardian_patients_summary(p_guardian_id UUID)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  adherence_rate NUMERIC,
  today_taken INTEGER,
  today_total INTEGER,
  last_update TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS patient_id,
    (p.first_name || ' ' || p.last_name) AS patient_name,
    calculate_adherence_rate(p.id, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE) AS adherence_rate,
    COUNT(CASE WHEN ml.status = 'taken' AND DATE(ml.scheduled_time) = CURRENT_DATE THEN 1 END)::INTEGER AS today_taken,
    COUNT(CASE WHEN DATE(ml.scheduled_time) = CURRENT_DATE THEN 1 END)::INTEGER AS today_total,
    MAX(ml.actual_time) AS last_update
  FROM profiles p
  JOIN guardian_patient_links gpl ON gpl.patient_id = p.id
  LEFT JOIN medication_logs ml ON ml.patient_id = p.id
  WHERE gpl.guardian_id = p_guardian_id
    AND gpl.status = 'active'
  GROUP BY p.id, p.first_name, p.last_name;
END;
$$;