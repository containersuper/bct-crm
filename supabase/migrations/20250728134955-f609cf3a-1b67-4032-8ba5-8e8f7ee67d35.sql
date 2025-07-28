-- Create email_processing_jobs table for tracking processing status
CREATE TABLE IF NOT EXISTS public.email_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  batch_size INTEGER DEFAULT 50,
  emails_processed INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  error_details JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on email_processing_jobs
ALTER TABLE public.email_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_processing_jobs
CREATE POLICY "System can manage processing jobs" ON public.email_processing_jobs
  FOR ALL USING (true);

CREATE POLICY "Users can view processing jobs" ON public.email_processing_jobs
  FOR SELECT USING (true);

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER update_email_processing_jobs_updated_at
  BEFORE UPDATE ON public.email_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_processing_jobs_status ON public.email_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_email_processing_jobs_type ON public.email_processing_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_email_processing_jobs_created_at ON public.email_processing_jobs(created_at);

-- Create function to start email processing
CREATE OR REPLACE FUNCTION public.start_email_processing(
  p_job_type TEXT DEFAULT 'batch_analysis',
  p_batch_size INTEGER DEFAULT 50
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_id UUID;
BEGIN
  -- Create new processing job
  INSERT INTO public.email_processing_jobs (job_type, batch_size, status)
  VALUES (p_job_type, p_batch_size, 'running')
  RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;

-- Create function to update processing job status
CREATE OR REPLACE FUNCTION public.update_processing_job(
  p_job_id UUID,
  p_status TEXT DEFAULT NULL,
  p_emails_processed INTEGER DEFAULT NULL,
  p_success_count INTEGER DEFAULT NULL,
  p_error_count INTEGER DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.email_processing_jobs
  SET
    status = COALESCE(p_status, status),
    emails_processed = COALESCE(p_emails_processed, emails_processed),
    success_count = COALESCE(p_success_count, success_count),
    error_count = COALESCE(p_error_count, error_count),
    error_details = COALESCE(p_error_details, error_details),
    end_time = CASE WHEN p_status IN ('completed', 'failed') THEN now() ELSE end_time END,
    updated_at = now()
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$;