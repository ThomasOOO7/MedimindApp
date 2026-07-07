-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule medication reminders to run every minute
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

-- Schedule missed dose checks to run every 5 minutes
SELECT cron.schedule(
  'check-missed-and-notify-guardians',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://nmdnvnzfdbezwuyovfdw.supabase.co/functions/v1/check-missed-and-notify-guardians',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZG52bnpmZGJlend1eW92ZmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzYwODQsImV4cCI6MjA3NzI1MjA4NH0.l2Ex7-MDLjaR5ZpI1D1MZ_r5sfm4gkCTUh5ROTY5E34"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule refill reminders to run daily at 9 AM
SELECT cron.schedule(
  'send-refill-reminders',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://nmdnvnzfdbezwuyovfdw.supabase.co/functions/v1/send-refill-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZG52bnpmZGJlend1eW92ZmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzYwODQsImV4cCI6MjA3NzI1MjA4NH0.l2Ex7-MDLjaR5ZpI1D1MZ_r5sfm4gkCTUh5ROTY5E34"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);