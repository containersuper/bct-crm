-- Fix email_analytics table constraint issue
ALTER TABLE public.email_analytics 
ADD CONSTRAINT email_analytics_email_id_unique UNIQUE (email_id);

-- Add analysis status to email_history for tracking
ALTER TABLE public.email_history 
ADD COLUMN analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add last_analyzed timestamp
ALTER TABLE public.email_history 
ADD COLUMN last_analyzed TIMESTAMP WITH TIME ZONE;

-- Add analysis_batch_id for tracking batch processing
ALTER TABLE public.email_analytics 
ADD COLUMN batch_id UUID;

-- Create index for faster queries
CREATE INDEX idx_email_history_analysis_status ON public.email_history(analysis_status);
CREATE INDEX idx_email_history_last_analyzed ON public.email_history(last_analyzed);
CREATE INDEX idx_email_analytics_batch_id ON public.email_analytics(batch_id);