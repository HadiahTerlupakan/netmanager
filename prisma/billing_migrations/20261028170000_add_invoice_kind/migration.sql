-- Jenis invoice eksplisit. Aturan "invoice prorate tidak memperpanjang
-- langganan" dulu bergantung pada awalan nomor invoice "PRORATE/".
DO $$ BEGIN
  CREATE TYPE "InvoiceKind" AS ENUM ('SUBSCRIPTION', 'PRORATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "kind" "InvoiceKind" NOT NULL DEFAULT 'SUBSCRIPTION';

UPDATE "Invoice" SET "kind" = 'PRORATE'
WHERE "invoiceNumber" LIKE 'PRORATE/%' AND "kind" <> 'PRORATE';

-- Jatuh tempo invoice adalah tanggal; invoice yang dibuat dengan jam
-- pembuatannya dibulatkan ke awal hari WIB (zona waktu semua tenant saat
-- migrasi ini ditulis). Kolom TIMESTAMP tanpa zona menyimpan jam UTC, jadi
-- dibaca sebagai UTC, dipotong di WIB, lalu dikembalikan ke UTC.
UPDATE "Invoice"
SET "dueDate" = (date_trunc('day', ("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'
WHERE "dueDate" <> (date_trunc('day', ("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC';
