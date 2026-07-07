-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create push_subscriptions table for storing push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- Create cron job to check for missed doses every 15 minutes
SELECT cron.schedule(
  'check-missed-doses-every-15-min',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url:='https://nmdnvnzfdbezwuyovfdw.supabase.co/functions/v1/check-missed-doses',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZG52bnpmZGJlend1eW92ZmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzYwODQsImV4cCI6MjA3NzI1MjA4NH0.l2Ex7-MDLjaR5ZpI1D1MZ_r5sfm4gkCTUh5ROTY5E34"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a function to send medication reminders
CREATE OR REPLACE FUNCTION public.send_medication_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This will be called by the edge function to create notifications
  -- for upcoming medications (30 minutes before scheduled time)
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
    AND m.time::time >= (NOW() + INTERVAL '25 minutes')::time
    AND m.time::time <= (NOW() + INTERVAL '35 minutes')::time
    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    -- Don't send if already sent in the last hour
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.patient_id
        AND n.type = 'medication_reminder'
        AND n.metadata->>'medication_id' = m.id::text
        AND n.created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$;