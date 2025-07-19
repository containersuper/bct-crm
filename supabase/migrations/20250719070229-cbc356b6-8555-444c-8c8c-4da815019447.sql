-- Create storage bucket for template images
INSERT INTO storage.buckets (id, name, public) VALUES ('template-images', 'template-images', true);

-- Create policies for template images
CREATE POLICY "Template images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'template-images');

CREATE POLICY "Authenticated users can upload template images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'template-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update template images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'template-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete template images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'template-images' AND auth.role() = 'authenticated');

-- Create email template types enum
CREATE TYPE email_template_type AS ENUM ('new_quote', 'follow_up', 'quote_accepted', 'invoice');

-- Create language enum
CREATE TYPE supported_language AS ENUM ('en', 'de', 'fr', 'nl');

-- Create email templates table
CREATE TABLE public.email_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type email_template_type NOT NULL,
    brand TEXT NOT NULL,
    language supported_language NOT NULL DEFAULT 'en',
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_ab_test BOOLEAN DEFAULT false,
    ab_test_group TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(type, brand, language, ab_test_group, is_active)
);

-- Create email template versions table
CREATE TABLE public.email_template_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create email template performance table
CREATE TABLE public.email_template_performance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(template_id, date)
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_performance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_templates
CREATE POLICY "Authenticated users can view email templates" 
ON public.email_templates 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create email templates" 
ON public.email_templates 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update email templates" 
ON public.email_templates 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete email templates" 
ON public.email_templates 
FOR DELETE 
TO authenticated
USING (true);

-- Create RLS policies for email_template_versions
CREATE POLICY "Authenticated users can view template versions" 
ON public.email_template_versions 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create template versions" 
ON public.email_template_versions 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create RLS policies for email_template_performance
CREATE POLICY "Authenticated users can view template performance" 
ON public.email_template_performance 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage template performance" 
ON public.email_template_performance 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Create function to update template versions
CREATE OR REPLACE FUNCTION public.create_template_version()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for template versioning
CREATE TRIGGER template_versioning_trigger
    AFTER UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.create_template_version();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    -- Increment version number on content changes
    IF OLD.subject != NEW.subject OR OLD.content != NEW.content THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_template_updated_at();

-- Insert sample email templates
INSERT INTO public.email_templates (name, type, brand, language, subject, content, variables) VALUES
('New Quote Notification - EN', 'new_quote', 'Brand 1', 'en', 
'Your Quote {{quote_number}} is Ready', 
'<h2>Dear {{customer_name}},</h2><p>Thank you for your inquiry. We are pleased to provide you with quote {{quote_number}} for your shipping requirements.</p><p><strong>Quote Details:</strong><br>Total Amount: {{total_amount}}<br>Valid Until: {{valid_until}}</p><p>Please review the attached quote and let us know if you have any questions.</p><p>Best regards,<br>{{brand_name}} Team</p>', 
'["customer_name", "quote_number", "total_amount", "valid_until", "brand_name"]'::jsonb),

('Follow-up Email - EN', 'follow_up', 'Brand 1', 'en',
'Following up on Quote {{quote_number}}',
'<h2>Hello {{customer_name}},</h2><p>We wanted to follow up on the quote {{quote_number}} we sent you on {{quote_date}}.</p><p>Do you have any questions about our proposal? We would be happy to discuss the details with you.</p><p>This quote is valid until {{valid_until}}.</p><p>Looking forward to hearing from you.</p><p>Best regards,<br>{{brand_name}} Team</p>',
'["customer_name", "quote_number", "quote_date", "valid_until", "brand_name"]'::jsonb),

('Quote Accepted - EN', 'quote_accepted', 'Brand 1', 'en',
'Thank you for accepting Quote {{quote_number}}',
'<h2>Dear {{customer_name}},</h2><p>Thank you for accepting our quote {{quote_number}}! We are excited to work with you.</p><p>Next steps:<br>1. We will prepare your shipping documentation<br>2. You will receive a tracking number within 24 hours<br>3. Our team will keep you updated throughout the process</p><p>If you have any questions, please do not hesitate to contact us.</p><p>Best regards,<br>{{brand_name}} Team</p>',
'["customer_name", "quote_number", "brand_name"]'::jsonb),

('Invoice Notification - EN', 'invoice', 'Brand 1', 'en',
'Invoice {{invoice_number}} for Quote {{quote_number}}',
'<h2>Dear {{customer_name}},</h2><p>Please find attached invoice {{invoice_number}} for the services provided under quote {{quote_number}}.</p><p><strong>Invoice Details:</strong><br>Amount: {{invoice_amount}}<br>Due Date: {{due_date}}</p><p>Payment can be made via bank transfer to the account details provided on the invoice.</p><p>Thank you for your business!</p><p>Best regards,<br>{{brand_name}} Team</p>',
'["customer_name", "invoice_number", "quote_number", "invoice_amount", "due_date", "brand_name"]'::jsonb);