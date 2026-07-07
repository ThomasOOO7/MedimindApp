-- Allow patients to view linked guardians' profiles
CREATE POLICY "Patients can view linked guardians' profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.guardian_patient_links gpl
    WHERE gpl.guardian_id = profiles.id
      AND gpl.patient_id = auth.uid()
      AND gpl.status = 'active'
  )
);
