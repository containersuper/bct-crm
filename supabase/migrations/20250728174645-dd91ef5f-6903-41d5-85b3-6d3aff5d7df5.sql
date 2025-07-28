-- Grant execute permissions to the functions for authenticated users
GRANT EXECUTE ON FUNCTION public.start_email_processing(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_processing_job(UUID, TEXT, INTEGER, INTEGER, INTEGER, JSONB) TO authenticated;

-- Also grant to service_role for edge functions
GRANT EXECUTE ON FUNCTION public.start_email_processing(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_processing_job(UUID, TEXT, INTEGER, INTEGER, INTEGER, JSONB) TO service_role;