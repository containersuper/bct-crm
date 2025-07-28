-- Add unique constraint on teamleader_id to enable proper upserts
ALTER TABLE public.customers 
ADD CONSTRAINT customers_teamleader_id_unique 
UNIQUE (teamleader_id);