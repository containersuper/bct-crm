-- Fix email constraint: Make email nullable since some TeamLeader contacts don't have emails
ALTER TABLE public.customers 
ALTER COLUMN email DROP NOT NULL;