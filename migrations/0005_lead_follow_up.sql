-- Nemesvill CRM: érdeklődők visszahívási időpontja
ALTER TABLE leads ADD COLUMN follow_up_at TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_follow_up
ON leads(status, follow_up_at);
