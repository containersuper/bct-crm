-- Fix function search path security issues by setting search_path parameter

-- Fix the update_email_accounts_updated_at function
CREATE OR REPLACE FUNCTION public.update_email_accounts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix the create_template_version function
CREATE OR REPLACE FUNCTION public.create_template_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    -- Insert new version when template is updated
    IF TG_OP = 'UPDATE' AND (OLD.subject != NEW.subject OR OLD.content != NEW.content) THEN
        INSERT INTO public.email_template_versions (
            template_id, version, subject, content, variables, created_by
        ) VALUES (
            NEW.id, NEW.version, NEW.subject, NEW.content, NEW.variables, NEW.created_by
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- Fix the update_template_updated_at function
CREATE OR REPLACE FUNCTION public.update_template_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    -- Increment version number on content changes
    IF OLD.subject != NEW.subject OR OLD.content != NEW.content THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$function$;

-- Fix the is_date_range_processed function
CREATE OR REPLACE FUNCTION public.is_date_range_processed(
  p_account_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.email_backfill_progress
    WHERE email_account_id = p_account_id
    AND status = 'completed'
    AND start_date <= p_start_date
    AND end_date >= p_end_date
  );
END;
$$;