-- Fix the get_guardian_patients_summary function to properly cast dates
DROP FUNCTION IF EXISTS public.get_guardian_patients_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_guardian_patients_summary(p_guardian_id uuid)
RETURNS TABLE(
  patient_id uuid,
  patient_name text,
  adherence_rate numeric,
  today_taken integer,
  today_total integer,
  last_update timestamp with time zone
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
    calculate_adherence_rate(p.id, (CURRENT_DATE - INTERVAL '7 days')::DATE, CURRENT_DATE) AS adherence_rate,
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

-- Create function to calculate current streak (consecutive days with >80% adherence)
CREATE OR REPLACE FUNCTION public.calculate_current_streak(p_patient_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_streak integer := 0;
  v_check_date date := CURRENT_DATE;
  v_daily_adherence numeric;
  v_scheduled_count integer;
BEGIN
  -- Loop through days from today backwards
  LOOP
    -- Count scheduled medications for this day
    SELECT COUNT(*) INTO v_scheduled_count
    FROM medication_logs
    WHERE patient_id = p_patient_id
      AND DATE(scheduled_time) = v_check_date;
    
    -- If no medications scheduled, break
    EXIT WHEN v_scheduled_count = 0;
    
    -- Calculate adherence for this day
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE (COUNT(CASE WHEN status = 'taken' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100
      END INTO v_daily_adherence
    FROM medication_logs
    WHERE patient_id = p_patient_id
      AND DATE(scheduled_time) = v_check_date;
    
    -- If adherence is less than 80%, break streak
    EXIT WHEN v_daily_adherence < 80;
    
    -- Increment streak and check previous day
    v_current_streak := v_current_streak + 1;
    v_check_date := v_check_date - INTERVAL '1 day';
    
    -- Safety limit to prevent infinite loops
    EXIT WHEN v_current_streak > 365;
  END LOOP;
  
  RETURN v_current_streak;
END;
$$;