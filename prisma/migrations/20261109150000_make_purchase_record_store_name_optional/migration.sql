-- Link belanja tidak lagi menanyakan nama toko; catatan lama tetap menyimpannya.
ALTER TABLE "purchase_records" ALTER COLUMN "storeName" DROP NOT NULL;
