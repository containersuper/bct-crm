-- Create email accounts table for storing OAuth credentials
CREATE TABLE IF NOT EXISTS public.email_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, provider, email)
);

-- Update email_history table to support the new integration
ALTER TABLE public.email_history 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS from_address TEXT,
ADD COLUMN IF NOT EXISTS to_address TEXT,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS thread_id TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Enable RLS on email_accounts
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_accounts
CREATE POLICY "Users can view their own email accounts" 
ON public.email_accounts 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email accounts" 
ON public.email_accounts 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email accounts" 
ON public.email_accounts 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email accounts" 
ON public.email_accounts 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Create function to update email_accounts timestamps
CREATE OR REPLACE FUNCTION public.update_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
CREATE TRIGGER update_email_accounts_updated_at
    BEFORE UPDATE ON public.email_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_email_accounts_updated_at();