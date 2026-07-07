-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule check-missed-and-notify-guardians to run every minute
SELECT cron.schedule(
  'check-missed-doses-and-notify',
  '* * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://nmdnvnzfdbezwuyovfdw.supabase.co/functions/v1/check-missed-and-notify-guardians',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZG52bnpmZGJlend1eW92ZmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzYwODQsImV4cCI6MjA3NzI1MjA4NH0.l2Ex7-MDLjaR5ZpI1D1MZ_r5sfm4gkCTUh5ROTY5E34"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule send-medication-reminders to run every minute (30 minutes before dose time)
SELECT cron.schedule(
  'send-medication-reminders',
  '* * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://nmdnvnzfdbezwuyovfdw.supabase.co/functions/v1/send-medication-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZG52bnpmZGJlend1eW92ZmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzYwODQsImV4cCI6MjA3NzI1MjA4NH0.l2Ex7-MDLjaR5ZpI1D1MZ_r5sfm4gkCTUh5ROTY5E34"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);