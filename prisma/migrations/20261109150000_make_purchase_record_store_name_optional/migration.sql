-- @safe-guard-ack: ALTER COLUMN "storeName" DROP NOT NULL hanya melonggarkan constraint; data lama tetap utuh. Tidak ada DROP TABLE/DROP COLUMN/TRUNCATE.
-- Link belanja tidak lagi menanyakan nama toko; catatan lama tetap menyimpannya.
ALTER TABLE "purchase_records" ALTER COLUMN "storeName" DROP NOT NULL;
