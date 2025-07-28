-- Create tables for additional TeamLeader data types

-- Deals/Opportunities table
CREATE TABLE public.teamleader_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamleader_id TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  value NUMERIC,
  currency TEXT DEFAULT 'EUR',
  phase TEXT,
  probability NUMERIC,
  expected_closing_date DATE,
  actual_closing_date DATE,
  lead_source TEXT,
  responsible_user_id TEXT,
  customer_id BIGINT REFERENCES public.customers(id),
  company_id TEXT,
  contact_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Invoices table (expand existing or create new)
CREATE TABLE public.teamleader_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamleader_id TEXT UNIQUE NOT NULL,
  invoice_number TEXT,
  title TEXT,
  description TEXT,
  total_price NUMERIC,
  currency TEXT DEFAULT 'EUR',
  invoice_date DATE,
  due_date DATE,
  payment_date DATE,
  status TEXT,
  customer_id BIGINT REFERENCES public.customers(id),
  company_id TEXT,
  contact_id TEXT,
  deal_id UUID REFERENCES public.teamleader_deals(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Quotes table (expand existing or create new)
CREATE TABLE public.teamleader_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamleader_id TEXT UNIQUE NOT NULL,
  quote_number TEXT,
  title TEXT,
  description TEXT,
  total_price NUMERIC,
  currency TEXT DEFAULT 'EUR',
  quote_date DATE,
  valid_until DATE,
  status TEXT,
  customer_id BIGINT REFERENCES public.customers(id),
  company_id TEXT,
  contact_id TEXT,
  deal_id UUID REFERENCES public.teamleader_deals(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Projects table
CREATE TABLE public.teamleader_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamleader_id TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  currency TEXT DEFAULT 'EUR',
  customer_id BIGINT REFERENCES public.customers(id),
  company_id TEXT,
  responsible_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activities/Tasks table
CREATE TABLE public.teamleader_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teamleader_id TEXT UNIQUE NOT NULL,
  activity_type TEXT,
  subject TEXT,
  description TEXT,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  location TEXT,
  status TEXT,
  customer_id BIGINT REFERENCES public.customers(id),
  deal_id UUID REFERENCES public.teamleader_deals(id),
  project_id UUID REFERENCES public.teamleader_projects(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.teamleader_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleader_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleader_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleader_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleader_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can manage deals" ON public.teamleader_deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage invoices" ON public.teamleader_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage quotes" ON public.teamleader_quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage projects" ON public.teamleader_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage activities" ON public.teamleader_activities FOR ALL USING (true) WITH CHECK (true);