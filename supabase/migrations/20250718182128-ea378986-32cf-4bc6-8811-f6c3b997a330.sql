-- Kunden Tabelle
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  company TEXT,
  phone TEXT,
  brand TEXT,
  teamleader_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Angebote Tabelle  
CREATE TABLE quotes (
  id BIGSERIAL PRIMARY KEY,
  quote_number TEXT UNIQUE NOT NULL,
  customer_id BIGINT REFERENCES customers(id),
  items JSONB,
  total_price DECIMAL(10,2),
  discount INTEGER,
  status TEXT DEFAULT 'draft',
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rechnungen Tabelle
CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  quote_id BIGINT REFERENCES quotes(id),
  customer_id BIGINT REFERENCES customers(id),
  amount DECIMAL(10,2),
  status TEXT DEFAULT 'draft',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Verlauf
CREATE TABLE email_history (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id),
  subject TEXT,
  body TEXT,
  direction TEXT,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) aktivieren
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies to allow authenticated users access
-- (You may want to customize these based on your business logic)
CREATE POLICY "Allow authenticated users to view customers" ON customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert customers" ON customers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update customers" ON customers
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete customers" ON customers
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to view quotes" ON quotes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert quotes" ON quotes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update quotes" ON quotes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete quotes" ON quotes
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to view invoices" ON invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert invoices" ON invoices
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update invoices" ON invoices
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete invoices" ON invoices
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to view email history" ON email_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert email history" ON email_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update email history" ON email_history
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete email history" ON email_history
  FOR DELETE TO authenticated USING (true);