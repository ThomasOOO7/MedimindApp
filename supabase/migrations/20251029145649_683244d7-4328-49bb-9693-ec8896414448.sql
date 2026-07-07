-- Fix function search_path for calculate_adherence_rate function
DROP FUNCTION IF EXISTS public.calculate_adherence_rate(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.calculate_adherence_rate(
  p_patient_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_scheduled INTEGER;
  v_taken INTEGER;
  v_adherence_rate NUMERIC;
BEGIN
  -- Count total scheduled doses
  SELECT COUNT(*) INTO v_total_scheduled
  FROM medication_logs
  WHERE patient_id = p_patient_id
    AND scheduled_time::DATE BETWEEN p_start_date AND p_end_date;

  -- Count taken doses
  SELECT COUNT(*) INTO v_taken
  FROM medication_logs
  WHERE patient_id = p_patient_id
    AND scheduled_time::DATE BETWEEN p_start_date AND p_end_date
    AND status = 'taken';

  -- Calculate adherence rate
  IF v_total_scheduled = 0 THEN
    RETURN 0;
  END IF;

  v_adherence_rate := (v_taken::NUMERIC / v_total_scheduled::NUMERIC) * 100;
  RETURN ROUND(v_adherence_rate, 2);
END;
$$;