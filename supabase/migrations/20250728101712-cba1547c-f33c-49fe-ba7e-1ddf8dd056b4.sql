-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to run AI analysis every hour
SELECT cron.schedule(
  'ai-analysis-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://xetonwascehmtslrwvpd.supabase.co/functions/v1/ai-analysis-cron',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldG9ud2FzY2VobXRzbHJ3dnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTU4NzgsImV4cCI6MjA2ODQzMTg3OH0.Ogcga7vT7V4PbrU73SjLi00FCpwGplDsXWX4O-L9Cfs"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job to run token refresh every 15 minutes
SELECT cron.schedule(
  'token-refresh-15min',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://xetonwascehmtslrwvpd.supabase.co/functions/v1/auto-token-refresh',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldG9ud2FzY2VobXRzbHJ3dnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTU4NzgsImV4cCI6MjA2ODQzMTg3OH0.Ogcga7vT7V4PbrU73SjLi00FCpwGplDsXWX4O-L9Cfs"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);