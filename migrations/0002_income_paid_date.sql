-- Nemesvill CRM: tényleges fizetési dátum a bevételi tételekhez
ALTER TABLE income_records ADD COLUMN paid_date TEXT;

-- A korábban fizetettnek jelölt tételeknél a számla/bevétel dátuma
-- csak visszamenőleges becslésként használható.
UPDATE income_records
SET paid_date = income_date
WHERE paid = 1 AND paid_date IS NULL;
