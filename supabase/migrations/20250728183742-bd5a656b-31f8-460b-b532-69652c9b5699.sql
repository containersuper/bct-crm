-- Enable cron extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job that runs every 4 hours to sync TeamLeader data
SELECT cron.schedule(
  'teamleader-auto-sync',
  '0 */4 * * *',  -- Every 4 hours
  $$
  SELECT
    net.http_post(
        url:='https://xetonwascehmtslrwvpd.supabase.co/functions/v1/teamleader-auto-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldG9ud2FzY2VobXRzbHJ3dnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg1NTg3OCwiZXhwIjoyMDY4NDMxODc4fQ.n9FbdOAcCF0MBXLQrOBLdKKiKLQaVmPE8sCqfmP4nds"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);