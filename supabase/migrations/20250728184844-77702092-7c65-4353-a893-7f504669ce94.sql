-- Make name field nullable too since some contacts might not have names
ALTER TABLE public.customers 
ALTER COLUMN name DROP NOT NULL;