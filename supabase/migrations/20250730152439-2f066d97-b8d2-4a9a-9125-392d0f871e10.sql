-- Create email_labels table to store AI categorization results
CREATE TABLE public.email_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id bigint NOT NULL REFERENCES public.email_history(id) ON DELETE CASCADE,
  label_type text NOT NULL CHECK (label_type IN ('NEUKUNDE', 'BESTANDSKUNDE', 'AUFTRAGSBEZOGEN', 'PREISANFRAGE', 'LIEFERANTEN-INFO', 'NEWSLETTER', 'URGENT')),
  confidence_score numeric(5,4) NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  is_ai_generated boolean NOT NULL DEFAULT true,
  manually_overridden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_email_labels_email_id ON public.email_labels(email_id);
CREATE INDEX idx_email_labels_type ON public.email_labels(label_type);
CREATE INDEX idx_email_labels_confidence ON public.email_labels(confidence_score DESC);

-- Enable RLS
ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view email labels" 
ON public.email_labels 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create email labels" 
ON public.email_labels 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update email labels" 
ON public.email_labels 
FOR UPDATE 
USING (true);

-- Create trigger for updating timestamps
CREATE TRIGGER update_email_labels_updated_at
BEFORE UPDATE ON public.email_labels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add customer tier information to customer intelligence for better categorization
ALTER TABLE public.customer_intelligence 
ADD COLUMN IF NOT EXISTS customer_tier text DEFAULT 'standard' CHECK (customer_tier IN ('bronze', 'silver', 'gold', 'platinum', 'standard'));

-- Enable realtime for email_labels table
ALTER TABLE public.email_labels REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_labels;