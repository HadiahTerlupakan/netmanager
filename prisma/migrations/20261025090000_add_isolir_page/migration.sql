-- ALTER di bawah tidak boleh menunggu lama di belakang transaksi panjang:
-- antrean kuncinya ikut memblokir semua akses ke tabel router. Bila habis
-- waktu, jalankan ulang job migrasi.
SET lock_timeout = '5s';

-- Cara router menampilkan halaman isolir: HTML di router sendiri atau redirect ke isolirUrl.
CREATE TYPE "IsolirMode" AS ENUM ('ROUTER_PAGE', 'REDIRECT');

ALTER TABLE "MikroTikRouter" ADD COLUMN     "isolirMode" "IsolirMode" NOT NULL DEFAULT 'ROUTER_PAGE',
ADD COLUMN     "isolirPageError" TEXT,
ADD COLUMN     "isolirPageHash" TEXT,
ADD COLUMN     "isolirPageSyncedAt" TIMESTAMP(3);

-- Router yang sudah punya isolirUrl memang dipakai untuk redirect; tanpa ini
-- ia akan berpindah ke halaman di router begitu migrasi jalan.
UPDATE "MikroTikRouter" SET "isolirMode" = 'REDIRECT' WHERE COALESCE(TRIM("isolirUrl"), '') <> '';

-- Isi halaman isolir satu tenant.
CREATE TABLE "isolir_pages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "ispName" TEXT,
    "title" TEXT,
    "message" TEXT,
    "logoUrl" TEXT,
    "payments" JSONB NOT NULL DEFAULT '[]',
    "whatsappNumber" TEXT,
    "whatsappText" TEXT,
    "linkLabel" TEXT,
    "linkUrl" TEXT,
    "contactText" TEXT,
    "primaryColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "isolir_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "isolir_pages_tenantId_key" ON "isolir_pages"("tenantId");

ALTER TABLE "isolir_pages" ADD CONSTRAINT "isolir_pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
