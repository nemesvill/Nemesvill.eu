-- Nemesvill CRM: kiadások tényleges fizetési állapota és dátuma
-- A korábbi tételek állapota ismeretlen marad (NULL), nem feltételezzük,
-- hogy a kiadás már ki lett fizetve.
ALTER TABLE expenses ADD COLUMN paid INTEGER;
ALTER TABLE expenses ADD COLUMN paid_date TEXT;
