-- Add unique constraint for email backfill progress upsert
ALTER TABLE public.email_backfill_progress 
ADD CONSTRAINT email_backfill_progress_unique_range 
UNIQUE (user_id, email_account_id, start_date, end_date);