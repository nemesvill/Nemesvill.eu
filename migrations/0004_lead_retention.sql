-- Lezárt, meg nem rendeléssé vált érdeklődések adatmegőrzési határideje.
ALTER TABLE leads ADD COLUMN closed_at TEXT;

-- A már lezárt státuszú rekordoknál az utolsó módosítás dátuma a kiindulópont.
UPDATE leads
SET closed_at = COALESCE(updated_at, created_at, datetime('now'))
WHERE status IN ('lost', 'archived') AND closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_retention
ON leads(status, closed_at);
