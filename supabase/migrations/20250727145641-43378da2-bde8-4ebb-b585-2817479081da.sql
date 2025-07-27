-- Add indexes for email search performance
CREATE INDEX IF NOT EXISTS idx_email_history_subject ON email_history USING gin(to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_email_history_body ON email_history USING gin(to_tsvector('english', body));
CREATE INDEX IF NOT EXISTS idx_email_history_from_address ON email_history(from_address);
CREATE INDEX IF NOT EXISTS idx_email_history_to_address ON email_history(to_address);
CREATE INDEX IF NOT EXISTS idx_email_history_brand ON email_history(brand);
CREATE INDEX IF NOT EXISTS idx_email_history_processed ON email_history(processed);
CREATE INDEX IF NOT EXISTS idx_email_history_received_at ON email_history(received_at DESC);

-- Add processed column if it doesn't exist (for email status tracking)
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;