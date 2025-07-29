-- Create storage bucket for TeamLeader PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('teamleader-pdfs', 'teamleader-pdfs', false);

-- Create storage policies for TeamLeader PDFs
CREATE POLICY "Authenticated users can view TeamLeader PDFs" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'teamleader-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "System can upload TeamLeader PDFs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'teamleader-pdfs');

CREATE POLICY "System can update TeamLeader PDFs" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'teamleader-pdfs');

-- Add pdf_url columns to store PDF file paths
ALTER TABLE teamleader_invoices ADD COLUMN pdf_url TEXT;
ALTER TABLE teamleader_quotes ADD COLUMN pdf_url TEXT;

-- Add download status tracking
ALTER TABLE teamleader_invoices ADD COLUMN pdf_download_status TEXT DEFAULT 'pending';
ALTER TABLE teamleader_quotes ADD COLUMN pdf_download_status TEXT DEFAULT 'pending';
ALTER TABLE teamleader_invoices ADD COLUMN pdf_downloaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE teamleader_quotes ADD COLUMN pdf_downloaded_at TIMESTAMP WITH TIME ZONE;