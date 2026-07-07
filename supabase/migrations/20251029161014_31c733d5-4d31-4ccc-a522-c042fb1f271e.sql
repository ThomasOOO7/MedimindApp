-- Ensure REPLICA IDENTITY FULL for real-time updates
ALTER TABLE public.medications REPLICA IDENTITY FULL;
ALTER TABLE public.guardian_patient_links REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.medication_logs REPLICA IDENTITY FULL;