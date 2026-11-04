-- Nemesvill CRM – Árajánlat modul
-- The production database already contains quotes and quote_items tables.
-- Keep their existing schema and data; only add the missing counter and
-- indexes that are compatible with the actual production columns.

CREATE TABLE IF NOT EXISTS quote_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotes_customer_created
  ON quotes(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_status_created
  ON quotes(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_order
  ON quote_items(quote_id, sort_order);
