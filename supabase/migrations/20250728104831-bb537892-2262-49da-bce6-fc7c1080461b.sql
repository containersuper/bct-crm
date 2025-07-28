-- Remove the expensive AI analysis cron job to reduce costs
SELECT cron.unschedule('ai-analysis-hourly');