-- Fix critical RLS policy issues

-- 1. Allow system to create notifications (triggered by database functions)
CREATE POLICY "System can create notifications for users"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- 2. Allow new users to create their own profile during registration
-- This policy is triggered by the handle_new_user function
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 3. Allow patients to delete guardian links they created
CREATE POLICY "Patients can delete guardian links"
ON public.guardian_patient_links
FOR DELETE
USING (auth.uid() = patient_id);

-- 4. Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Fix function search paths that were flagged
-- Update get_todays_schedule function
DROP FUNCTION IF EXISTS public.get_todays_schedule(UUID);
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
SET search_path TO public
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

-- Update log_medication_taken function
DROP FUNCTION IF EXISTS public.log_medication_taken(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, INTEGER);
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
SET search_path TO public
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

-- Update get_medication_history function
DROP FUNCTION IF EXISTS public.get_medication_history(UUID, UUID, INTEGER);
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
SET search_path TO public
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

-- Update get_guardian_patients_summary function
DROP FUNCTION IF EXISTS public.get_guardian_patients_summary(UUID);
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
SET search_path TO public
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