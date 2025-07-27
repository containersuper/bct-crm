-- Add columns for sync tracking to email_accounts table
ALTER TABLE public.email_accounts 
ADD COLUMN IF NOT EXISTS last_sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS quota_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_quota_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS sync_error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_error TEXT DEFAULT NULL;

-- Create index for better performance on email queries
CREATE INDEX IF NOT EXISTS idx_email_history_received_at ON public.email_history(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_history_external_id ON public.email_history(external_id);

-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to sync emails every 10 minutes
SELECT cron.schedule(
  'sync-emails-every-10-minutes',
  '*/10 * * * *', -- Every 10 minutes
  $$
  select
    net.http_post(
        url:='https://xetonwascehmtslrwvpd.supabase.co/functions/v1/sync-emails-cron',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldG9ud2FzY2VobXRzbHJ3dnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTU4NzgsImV4cCI6MjA2ODQzMTg3OH0.Ogcga7vT7V4PbrU73SjLi00FCpwGplDsXWX4O-L9Cfs"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);