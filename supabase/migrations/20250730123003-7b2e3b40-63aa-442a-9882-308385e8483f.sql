-- Remove the view and create a secure function instead
DROP VIEW IF EXISTS email_intelligence_summary;

-- Create a secure function to get email intelligence data
CREATE OR REPLACE FUNCTION get_email_intelligence_summary(
    limit_count integer DEFAULT 100,
    offset_count integer DEFAULT 0,
    filter_intent text DEFAULT NULL,
    filter_urgency text DEFAULT NULL
)
RETURNS TABLE (
    id bigint,
    subject text,
    from_address text,
    to_address text,
    created_at timestamp with time zone,
    brand text,
    language character varying,
    sentiment character varying,
    sentiment_score numeric,
    intent character varying,
    intent_confidence numeric,
    urgency character varying,
    urgency_priority integer,
    entities jsonb,
    key_phrases jsonb,
    analysis_timestamp timestamp with time zone,
    customer_name text,
    customer_company text,
    opportunity_score numeric,
    risk_score numeric,
    next_best_action text,
    price_sensitivity character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;

    RETURN QUERY
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
    WHERE ea.intent IS NOT NULL
        AND (filter_intent IS NULL OR ea.intent = filter_intent)
        AND (filter_urgency IS NULL OR ea.urgency = filter_urgency)
    ORDER BY ea.urgency_priority DESC, ea.intent_confidence DESC, eh.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;

-- Create additional helper functions for AI assistant queries
CREATE OR REPLACE FUNCTION get_customer_email_history(customer_email text)
RETURNS TABLE (
    email_id bigint,
    subject text,
    intent character varying,
    sentiment character varying,
    urgency character varying,
    created_at timestamp with time zone,
    key_phrases jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;

    RETURN QUERY
    SELECT 
        eh.id as email_id,
        eh.subject,
        ea.intent,
        ea.sentiment,
        ea.urgency,
        eh.created_at,
        ea.key_phrases
    FROM email_history eh
    LEFT JOIN email_analytics ea ON eh.id = ea.email_id
    WHERE eh.from_address ILIKE '%' || customer_email || '%'
        OR eh.to_address ILIKE '%' || customer_email || '%'
    ORDER BY eh.created_at DESC;
END;
$$;

-- Function to get pricing inquiry insights
CREATE OR REPLACE FUNCTION get_pricing_insights()
RETURNS TABLE (
    total_inquiries bigint,
    avg_confidence numeric,
    common_entities jsonb,
    urgency_breakdown jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;

    RETURN QUERY
    SELECT 
        COUNT(*)::bigint as total_inquiries,
        AVG(ea.intent_confidence) as avg_confidence,
        jsonb_agg(DISTINCT ea.entities) as common_entities,
        jsonb_object_agg(ea.urgency, COUNT(*)) as urgency_breakdown
    FROM email_analytics ea
    WHERE ea.intent = 'price_inquiry';
END;
$$;