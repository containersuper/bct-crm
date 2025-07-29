-- Remove the foreign key constraint on deal_id in teamleader_invoices
-- This will allow invoices to be imported even if their referenced deals don't exist yet
ALTER TABLE teamleader_invoices DROP CONSTRAINT IF EXISTS teamleader_invoices_deal_id_fkey;

-- Make deal_id nullable to handle cases where invoices don't have associated deals
ALTER TABLE teamleader_invoices ALTER COLUMN deal_id DROP NOT NULL;