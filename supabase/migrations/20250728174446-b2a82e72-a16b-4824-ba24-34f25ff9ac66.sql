-- Create function to start email processing job
CREATE OR REPLACE FUNCTION public.start_email_processing(
  p_job_type TEXT,
  p_batch_size INTEGER DEFAULT 50
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_id UUID;
BEGIN
  -- Insert new processing job
  INSERT INTO public.email_processing_jobs (
    job_type,
    batch_size,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_job_type,
    p_batch_size,
    'running',
    now(),
    now()
  ) RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;

-- Create function to update processing job
CREATE OR REPLACE FUNCTION public.update_processing_job(
  p_job_id UUID,
  p_status TEXT,
  p_emails_processed INTEGER DEFAULT NULL,
  p_success_count INTEGER DEFAULT NULL,
  p_error_count INTEGER DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.email_processing_jobs
  SET 
    status = p_status,
    emails_processed = COALESCE(p_emails_processed, emails_processed),
    success_count = COALESCE(p_success_count, success_count),
    error_count = COALESCE(p_error_count, error_count),
    error_details = COALESCE(p_error_details, error_details),
    updated_at = now(),
    completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN now() ELSE completed_at END
  WHERE id = p_job_id;
END;
$$;