-- First, let's check what job types are allowed and fix the constraint
-- Check current constraint on email_processing_jobs
DO $$
BEGIN
    -- Check if the constraint exists and what values are allowed
    IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'email_processing_jobs_job_type_check') THEN
        -- Drop the existing constraint that's causing issues
        ALTER TABLE email_processing_jobs DROP CONSTRAINT email_processing_jobs_job_type_check;
    END IF;
    
    -- Add a new constraint that allows the job types we need
    ALTER TABLE email_processing_jobs ADD CONSTRAINT email_processing_jobs_job_type_check 
        CHECK (job_type IN ('smart_analysis', 'batch_analysis', 'full_processing', 'email_analysis'));
END $$;

-- Optimize email_analytics table for AI assistant queries
-- Add indexes for fast AI assistant lookups
CREATE INDEX IF NOT EXISTS idx_email_analytics_intent ON email_analytics(intent);
CREATE INDEX IF NOT EXISTS idx_email_analytics_sentiment ON email_analytics(sentiment);
CREATE INDEX IF NOT EXISTS idx_email_analytics_urgency ON email_analytics(urgency);
CREATE INDEX IF NOT EXISTS idx_email_analytics_language ON email_analytics(language);
CREATE INDEX IF NOT EXISTS idx_email_analytics_confidence ON email_analytics(intent_confidence);

-- Add composite indexes for complex AI queries
CREATE INDEX IF NOT EXISTS idx_email_analytics_intent_confidence ON email_analytics(intent, intent_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_email_analytics_sentiment_urgency ON email_analytics(sentiment, urgency);

-- Add indexes on email_history for faster joins and filtering
CREATE INDEX IF NOT EXISTS idx_email_history_from_address ON email_history(from_address);
CREATE INDEX IF NOT EXISTS idx_email_history_subject ON email_history USING gin(to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_email_history_body ON email_history USING gin(to_tsvector('english', body));
CREATE INDEX IF NOT EXISTS idx_email_history_analysis_status ON email_history(analysis_status);
CREATE INDEX IF NOT EXISTS idx_email_history_brand ON email_history(brand);

-- Add customer intelligence optimization indexes
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_opportunity ON customer_intelligence(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_risk ON customer_intelligence(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_last_analysis ON customer_intelligence(last_analysis DESC);

-- Optimize AI performance metrics for analytics
CREATE INDEX IF NOT EXISTS idx_ai_metrics_type_time ON ai_performance_metrics(metric_type, measured_at DESC);

-- Add computed columns for faster AI queries (stored as generated columns)
-- Add a computed sentiment category for easy filtering
ALTER TABLE email_analytics ADD COLUMN IF NOT EXISTS sentiment_category text 
    GENERATED ALWAYS AS (
        CASE 
            WHEN sentiment_score >= 0.7 THEN 'positive'
            WHEN sentiment_score <= 0.3 THEN 'negative'
            ELSE 'neutral'
        END
    ) STORED;

-- Add urgency priority for sorting
ALTER TABLE email_analytics ADD COLUMN IF NOT EXISTS urgency_priority integer 
    GENERATED ALWAYS AS (
        CASE urgency
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
        END
    ) STORED;

-- Create materialized view for fast AI assistant queries
CREATE MATERIALIZED VIEW IF NOT EXISTS email_intelligence_summary AS
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

-- Add index on materialized view
CREATE INDEX IF NOT EXISTS idx_email_intelligence_intent ON email_intelligence_summary(intent, intent_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_email_intelligence_urgency ON email_intelligence_summary(urgency_priority DESC);
CREATE INDEX IF NOT EXISTS idx_email_intelligence_customer ON email_intelligence_summary(customer_name, customer_company);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_email_intelligence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY email_intelligence_summary;
END;
$$;