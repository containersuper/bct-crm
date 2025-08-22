-- Add new columns to quotes table for AI-generated quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS email_id bigint;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS pricing_breakdown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS terms jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS brand text DEFAULT 'bct'::text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS ai_reasoning jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS reference_number text;

-- Create container_pricing table for market pricing data
CREATE TABLE IF NOT EXISTS public.container_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  container_type text NOT NULL,
  route_from text NOT NULL,
  route_to text NOT NULL,
  base_price numeric NOT NULL,
  transport_cost numeric NOT NULL,
  handling_fee numeric NOT NULL,
  market_conditions jsonb DEFAULT '{}'::jsonb,
  currency text DEFAULT 'EUR'::text,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on container_pricing table
ALTER TABLE public.container_pricing ENABLE ROW LEVEL SECURITY;

-- Create policies for container_pricing
CREATE POLICY "Authenticated users can view container pricing" 
ON public.container_pricing 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage container pricing" 
ON public.container_pricing 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add some sample pricing data
INSERT INTO public.container_pricing (container_type, route_from, route_to, base_price, transport_cost, handling_fee, market_conditions) VALUES
('20ft', 'Hamburg', 'Berlin', 2500, 800, 200, '{"demand": "high", "availability": "medium"}'),
('40ft', 'Hamburg', 'Berlin', 4000, 1200, 300, '{"demand": "high", "availability": "medium"}'),
('20ft', 'Rotterdam', 'Amsterdam', 2200, 600, 150, '{"demand": "medium", "availability": "high"}'),
('40ft', 'Rotterdam', 'Amsterdam', 3800, 900, 250, '{"demand": "medium", "availability": "high"}'),
('20ft', 'Antwerp', 'Brussels', 2300, 700, 180, '{"demand": "medium", "availability": "medium"}'),
('40ft', 'Antwerp', 'Brussels', 3900, 1000, 280, '{"demand": "medium", "availability": "medium"}');

-- Add trigger for updating updated_at timestamp
CREATE TRIGGER update_container_pricing_updated_at
BEFORE UPDATE ON public.container_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();