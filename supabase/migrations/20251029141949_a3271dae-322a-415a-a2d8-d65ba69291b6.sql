-- Create user_type enum
CREATE TYPE user_type AS ENUM ('patient', 'guardian');

-- Create frequency enum
CREATE TYPE medication_frequency AS ENUM ('daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'weekly', 'as_needed');

-- Create medication_unit enum
CREATE TYPE medication_unit AS ENUM ('mg', 'ml', 'tablet', 'capsule', 'drops', 'spray', 'patch');

-- Create log_status enum
CREATE TYPE log_status AS ENUM ('taken', 'missed', 'skipped');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type user_type NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  profile_photo_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  healthcare_provider TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create guardian_patient_links table (before profiles policies that reference it)
CREATE TABLE public.guardian_patient_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  permissions JSONB DEFAULT '{"view_schedule": true, "receive_alerts": true, "emergency_contact": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guardian_id, patient_id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Guardians can view linked patients' profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guardian_patient_links
      WHERE patient_id = profiles.id
      AND guardian_id = auth.uid()
      AND status = 'active'
    )
  );

-- Create medications table
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  unit medication_unit NOT NULL,
  frequency medication_frequency NOT NULL,
  time TIME NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  instructions TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on medications
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Medications policies
CREATE POLICY "Patients can manage their own medications"
  ON public.medications FOR ALL
  USING (auth.uid() = patient_id);

CREATE POLICY "Guardians can view linked patients' medications"
  ON public.medications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guardian_patient_links
      WHERE patient_id = medications.patient_id
      AND guardian_id = auth.uid()
      AND status = 'active'
    )
  );

-- Create medication_logs table
CREATE TABLE public.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_time TIMESTAMP WITH TIME ZONE,
  status log_status NOT NULL,
  notes TEXT,
  side_effects TEXT,
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on medication_logs
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- Medication logs policies
CREATE POLICY "Patients can manage their own medication logs"
  ON public.medication_logs FOR ALL
  USING (auth.uid() = patient_id);

CREATE POLICY "Guardians can view linked patients' medication logs"
  ON public.medication_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guardian_patient_links
      WHERE patient_id = medication_logs.patient_id
      AND guardian_id = auth.uid()
      AND status = 'active'
    )
  );

-- Enable RLS on guardian_patient_links
ALTER TABLE public.guardian_patient_links ENABLE ROW LEVEL SECURITY;

-- Guardian links policies
CREATE POLICY "Users can view their own guardian/patient links"
  ON public.guardian_patient_links FOR SELECT
  USING (auth.uid() = guardian_id OR auth.uid() = patient_id);

CREATE POLICY "Patients can create guardian links"
  ON public.guardian_patient_links FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can update their own links"
  ON public.guardian_patient_links FOR UPDATE
  USING (auth.uid() = guardian_id OR auth.uid() = patient_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_type, first_name, last_name, phone, date_of_birth)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'patient')::user_type,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guardian_patient_links_updated_at
  BEFORE UPDATE ON public.guardian_patient_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate adherence rate
CREATE OR REPLACE FUNCTION public.calculate_adherence_rate(
  p_patient_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_logs INTEGER;
  taken_logs INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_logs
  FROM public.medication_logs
  WHERE patient_id = p_patient_id
  AND DATE(scheduled_time) BETWEEN p_start_date AND p_end_date;

  IF total_logs = 0 THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO taken_logs
  FROM public.medication_logs
  WHERE patient_id = p_patient_id
  AND status = 'taken'
  AND DATE(scheduled_time) BETWEEN p_start_date AND p_end_date;

  RETURN ROUND((taken_logs::DECIMAL / total_logs::DECIMAL) * 100, 2);
END;
$$;

-- Enable realtime for medication_logs (for guardian notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_logs;
ALTER TABLE public.medication_logs REPLICA IDENTITY FULL;