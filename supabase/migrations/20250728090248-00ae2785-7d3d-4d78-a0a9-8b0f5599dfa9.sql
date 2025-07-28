-- Fix function search path security issue
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.update_email_accounts_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_template_updated_at() SET search_path = 'public';
ALTER FUNCTION public.create_template_version() SET search_path = 'public';
ALTER FUNCTION public.is_date_range_processed(uuid, date, date) SET search_path = 'public';