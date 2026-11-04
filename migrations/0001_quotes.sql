-- Nemesvill CRM – Árajánlat modul
-- Additive migration: does not modify or delete existing CRM data.

CREATE TABLE IF NOT EXISTS quote_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  lead_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  valid_until TEXT,
  payment_terms TEXT,
  tax_mode TEXT NOT NULL DEFAULT 'AAM'
    CHECK (tax_mode = 'AAM'),
  subtotal INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  converted_job_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (converted_job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'db',
  unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quotes_customer_created
  ON quotes(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_status_created
  ON quotes(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_order
  ON quote_items(quote_id, sort_order, created_at);
