-- Drop the materialized view and create a regular view instead for better security
DROP MATERIALIZED VIEW IF EXISTS email_intelligence_summary CASCADE;

-- Create a regular view that can have RLS policies
CREATE VIEW email_intelligence_summary AS
SELECT 
    eh.id,
    eh.subject,
    eh.from_address,
    eh.to_address,
    eh.created_at,
    eh.brand,
    ea.language,
    ea.sentiment,
    ea.sentiment_score,
    ea.intent,
    ea.intent_confidence,
    ea.urgency,
    ea.urgency_priority,
    ea.entities,
    ea.key_phrases,
    ea.analysis_timestamp,
    -- Customer context
    c.name as customer_name,
    c.company as customer_company,
    -- Intelligence context
    ci.opportunity_score,
    ci.risk_score,
    ci.next_best_action,
    ci.price_sensitivity
FROM email_history eh
LEFT JOIN email_analytics ea ON eh.id = ea.email_id
LEFT JOIN customers c ON eh.customer_id = c.id
LEFT JOIN customer_intelligence ci ON c.id = ci.customer_id
WHERE ea.intent IS NOT NULL;

-- Enable RLS on the view
ALTER VIEW email_intelligence_summary ENABLE ROW LEVEL SECURITY;

-- Create policy for the view
CREATE POLICY "Authenticated users can view email intelligence summary" 
ON email_intelligence_summary FOR SELECT 
TO authenticated 
USING (true);

-- Update the refresh function to handle the view change
CREATE OR REPLACE FUNCTION refresh_email_intelligence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Since we're using a view now, no refresh needed
    -- This function is kept for compatibility
    RETURN;
END;
$$;

-- Remove the triggers since views don't need refreshing
DROP TRIGGER IF EXISTS refresh_intelligence_on_analytics_update ON email_analytics;
DROP TRIGGER IF EXISTS refresh_intelligence_on_customer_update ON customer_intelligence;
DROP FUNCTION IF EXISTS trigger_refresh_email_intelligence();