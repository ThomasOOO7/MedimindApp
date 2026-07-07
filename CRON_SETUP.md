# Cron Jobs Setup for MediMind

To enable real-time medication reminders, refill reminders, and missed dose notifications, you need to set up the following cron jobs in your Supabase SQL Editor.

## Prerequisites

1. Enable the `pg_cron` and `pg_net` extensions in your Supabase project
2. Go to: https://supabase.com/dashboard/project/nmdnvnzfdbezwuyovfdw/sql/new

## Cron Jobs to Create

### 1. Medication Reminders (Every Minute)

Run this SQL to send medication reminders every minute:

```sql
SELECT cron.schedule(
  'send-medication-reminders-every-minute',
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
```

### 2. Refill Reminders (Daily at 9 AM)

Run this SQL to send refill reminders daily:

```sql
SELECT cron.schedule(
  'send-refill-reminders-daily',
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
```

### 3. Check Missed Doses (Every 5 Minutes)

Run this SQL to check for missed doses every 5 minutes:

```sql
SELECT cron.schedule(
  'check-missed-doses-every-5-minutes',
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
```

## Verify Cron Jobs

After creating the cron jobs, verify they're running:

```sql
SELECT * FROM cron.job;
```

## Monitor Cron Job Execution

Check cron job execution history:

```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## Delete/Update Cron Jobs

If you need to remove a cron job:

```sql
SELECT cron.unschedule('send-medication-reminders-every-minute');
SELECT cron.unschedule('send-refill-reminders-daily');
SELECT cron.unschedule('check-missed-doses-every-5-minutes');
```

## What Each Job Does

1. **Medication Reminders**: Sends push notifications 1 minute before scheduled medication times
2. **Refill Reminders**: Checks for medications ending within 3 days and sends refill reminders
3. **Missed Doses**: Checks for missed doses and notifies guardians about patient adherence issues
