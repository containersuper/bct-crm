-- Create tables for AI-powered CRM features

-- Email analytics table for storing Claude analysis results
CREATE TABLE IF NOT EXISTS public.email_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES email_history(id) ON DELETE CASCADE,
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral',
    sentiment_score DECIMAL(3,2) DEFAULT 0.0,
    intent VARCHAR(50) NOT NULL DEFAULT 'unknown',
    intent_confidence DECIMAL(3,2) DEFAULT 0.0,
    urgency VARCHAR(20) NOT NULL DEFAULT 'low',
    entities JSONB DEFAULT '[]'::jsonb,
    key_phrases JSONB DEFAULT '[]'::jsonb,
    analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customer intelligence table for AI-generated insights
CREATE TABLE IF NOT EXISTS public.customer_intelligence (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    ai_summary TEXT,
    communication_style JSONB DEFAULT '{}'::jsonb,
    business_patterns JSONB DEFAULT '{}'::jsonb,
    price_sensitivity VARCHAR(20) DEFAULT 'medium',
    decision_factors JSONB DEFAULT '[]'::jsonb,
    lifetime_value DECIMAL(10,2) DEFAULT 0.0,
    risk_score DECIMAL(3,2) DEFAULT 0.0,
    opportunity_score DECIMAL(3,2) DEFAULT 0.0,
    next_best_action TEXT,
    last_analysis TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI responses table for storing generated responses
CREATE TABLE IF NOT EXISTS public.ai_responses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES email_history(id) ON DELETE CASCADE,
    response_content TEXT NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    tone VARCHAR(20) DEFAULT 'professional',
    version INTEGER DEFAULT 1,
    is_sent BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI performance metrics table
CREATE TABLE IF NOT EXISTS public.ai_performance_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for all tables
ALTER TABLE public.email_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_analytics
CREATE POLICY "Authenticated users can view email analytics" 
ON public.email_analytics FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create email analytics" 
ON public.email_analytics FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update email analytics" 
ON public.email_analytics FOR UPDATE 
USING (true);

-- RLS policies for customer_intelligence
CREATE POLICY "Authenticated users can view customer intelligence" 
ON public.customer_intelligence FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create customer intelligence" 
ON public.customer_intelligence FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer intelligence" 
ON public.customer_intelligence FOR UPDATE 
USING (true);

-- RLS policies for ai_responses
CREATE POLICY "Authenticated users can view AI responses" 
ON public.ai_responses FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create AI responses" 
ON public.ai_responses FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update AI responses" 
ON public.ai_responses FOR UPDATE 
USING (true);

-- RLS policies for ai_performance_metrics
CREATE POLICY "Authenticated users can view AI performance metrics" 
ON public.ai_performance_metrics FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create AI performance metrics" 
ON public.ai_performance_metrics FOR INSERT 
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_analytics_email_id ON email_analytics(email_id);
CREATE INDEX IF NOT EXISTS idx_email_analytics_sentiment ON email_analytics(sentiment);
CREATE INDEX IF NOT EXISTS idx_email_analytics_urgency ON email_analytics(urgency);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_customer_id ON customer_intelligence(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_email_id ON ai_responses(email_id);
CREATE INDEX IF NOT EXISTS idx_ai_performance_metrics_type ON ai_performance_metrics(metric_type);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_intelligence_updated_at
    BEFORE UPDATE ON customer_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_responses_updated_at
    BEFORE UPDATE ON ai_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();