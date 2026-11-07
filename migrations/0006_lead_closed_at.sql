-- Nemesvill CRM: lezárt érdeklődések megőrzési dátuma
-- Az éles adatbázisban a korábbi 0004 migráció nem futott le.
ALTER TABLE leads ADD COLUMN closed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_retention
ON leads(status, closed_at);
