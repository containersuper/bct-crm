-- Create table to track batch import progress
CREATE TABLE IF NOT EXISTS public.teamleader_batch_import_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  import_type TEXT NOT NULL CHECK (import_type IN ('contacts', 'companies', 'deals', 'invoices', 'quotes', 'projects')),
  total_estimated INTEGER DEFAULT 0,
  total_imported INTEGER DEFAULT 0,
  last_imported_page INTEGER DEFAULT 0,
  last_imported_id TEXT DEFAULT NULL,
  batch_size INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'paused')),
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.teamleader_batch_import_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own batch import progress" 
ON public.teamleader_batch_import_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own batch import progress" 
ON public.teamleader_batch_import_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batch import progress" 
ON public.teamleader_batch_import_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_batch_import_progress_updated_at
BEFORE UPDATE ON public.teamleader_batch_import_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX idx_batch_import_progress_user_type ON public.teamleader_batch_import_progress(user_id, import_type);