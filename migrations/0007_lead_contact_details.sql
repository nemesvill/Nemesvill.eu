-- Az érdeklődők kapcsolati adatai önállóan tárolódnak; nem hozunk létre automatikusan ügyfelet.
ALTER TABLE leads ADD COLUMN contact_name TEXT;
ALTER TABLE leads ADD COLUMN contact_phone TEXT;
