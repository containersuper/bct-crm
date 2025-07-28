-- Create TeamLeader integration tables

-- Table for storing TeamLeader connection details
CREATE TABLE public.teamleader_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for field mappings between our system and TeamLeader
CREATE TABLE public.teamleader_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  our_field TEXT NOT NULL,
  teamleader_field TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'contact', 'company', 'deal'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for sync history and status
CREATE TABLE public.teamleader_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'import', 'export', 'bidirectional'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  records_processed INTEGER DEFAULT 0,
  records_success INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for storing sync conflicts
CREATE TABLE public.teamleader_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- 'contact', 'company'
  our_record_id BIGINT,
  teamleader_record_id TEXT,
  conflict_field TEXT NOT NULL,
  our_value TEXT,
  teamleader_value TEXT,
  resolution TEXT, -- 'pending', 'use_ours', 'use_theirs', 'manual'
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teamleader_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleader_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleader_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleader_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own TeamLeader connections" 
ON public.teamleader_connections 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own field mappings" 
ON public.teamleader_field_mappings 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sync history" 
ON public.teamleader_sync_history 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own conflicts" 
ON public.teamleader_conflicts 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updating timestamps
CREATE TRIGGER update_teamleader_connections_updated_at
  BEFORE UPDATE ON public.teamleader_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default field mappings
INSERT INTO public.teamleader_field_mappings (user_id, our_field, teamleader_field, field_type) VALUES
(auth.uid(), 'name', 'first_name', 'contact'),
(auth.uid(), 'email', 'email', 'contact'),
(auth.uid(), 'phone', 'telephone', 'contact'),
(auth.uid(), 'company', 'company_name', 'contact'),
(auth.uid(), 'name', 'name', 'company'),
(auth.uid(), 'email', 'email', 'company'),
(auth.uid(), 'phone', 'telephone', 'company');