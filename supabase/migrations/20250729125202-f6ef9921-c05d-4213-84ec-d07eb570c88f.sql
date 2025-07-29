-- Create teamleader_companies table to store company data from TeamLeader
CREATE TABLE IF NOT EXISTS public.teamleader_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teamleader_id TEXT NOT NULL UNIQUE,
  name TEXT,
  vat_number TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  business_type TEXT,
  currency TEXT DEFAULT 'EUR',
  customer_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teamleader_companies ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can manage companies" 
ON public.teamleader_companies 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_teamleader_companies_updated_at
BEFORE UPDATE ON public.teamleader_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();