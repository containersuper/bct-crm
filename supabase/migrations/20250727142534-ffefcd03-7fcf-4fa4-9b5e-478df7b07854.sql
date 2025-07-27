-- Create table to track email backfill progress
CREATE TABLE public.email_backfill_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  emails_processed INTEGER DEFAULT 0,
  total_estimated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  quota_used INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.email_backfill_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for backfill progress
CREATE POLICY "Users can view their own backfill progress" 
ON public.email_backfill_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own backfill progress" 
ON public.email_backfill_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backfill progress" 
ON public.email_backfill_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backfill progress" 
ON public.email_backfill_progress 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_email_backfill_progress_updated_at
BEFORE UPDATE ON public.email_backfill_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_email_accounts_updated_at();

-- Add indexes for better performance
CREATE INDEX idx_email_backfill_progress_user_id ON public.email_backfill_progress(user_id);
CREATE INDEX idx_email_backfill_progress_account_id ON public.email_backfill_progress(email_account_id);
CREATE INDEX idx_email_backfill_progress_status ON public.email_backfill_progress(status);
CREATE INDEX idx_email_backfill_progress_dates ON public.email_backfill_progress(start_date, end_date);

-- Add backfill mode and tracking columns to email_accounts
ALTER TABLE public.email_accounts 
ADD COLUMN IF NOT EXISTS backfill_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS backfill_start_date DATE,
ADD COLUMN IF NOT EXISTS backfill_end_date DATE,
ADD COLUMN IF NOT EXISTS last_backfill_timestamp TIMESTAMP WITH TIME ZONE;

-- Create function to check if date range is already processed
CREATE OR REPLACE FUNCTION public.is_date_range_processed(
  p_account_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.email_backfill_progress
    WHERE email_account_id = p_account_id
    AND status = 'completed'
    AND start_date <= p_start_date
    AND end_date >= p_end_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;