-- Fix the security warnings

-- 1. Fix function search path mutability by setting search_path explicitly
CREATE OR REPLACE FUNCTION refresh_email_intelligence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY email_intelligence_summary;
END;
$$;

-- 2. Create RLS policy for the materialized view to control API access
ALTER MATERIALIZED VIEW email_intelligence_summary ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read the intelligence summary
CREATE POLICY "Authenticated users can view email intelligence summary" 
ON email_intelligence_summary FOR SELECT 
TO authenticated 
USING (true);

-- 3. Create a trigger to automatically refresh the materialized view when email analytics are updated
CREATE OR REPLACE FUNCTION trigger_refresh_email_intelligence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Schedule a refresh in the background (non-blocking)
    PERFORM pg_notify('refresh_email_intelligence', '');
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on relevant tables
DROP TRIGGER IF EXISTS refresh_intelligence_on_analytics_update ON email_analytics;
CREATE TRIGGER refresh_intelligence_on_analytics_update
    AFTER INSERT OR UPDATE OR DELETE ON email_analytics
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_email_intelligence();

DROP TRIGGER IF EXISTS refresh_intelligence_on_customer_update ON customer_intelligence;
CREATE TRIGGER refresh_intelligence_on_customer_update
    AFTER INSERT OR UPDATE OR DELETE ON customer_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_email_intelligence();