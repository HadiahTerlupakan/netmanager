-- Penjaga bagi hasil dobel: satu baris per (investor, proyek RAB, bulan ke-n) yang
-- sudah dibagikan. Unique (investorId, rabProjectId, month) membuat kalkulasi kedua
-- yang berjalan bersamaan gagal di DB, bukan menghasilkan bagi hasil ganda.
-- Aditif: tabel baru + isi dari bagi hasil per proyek yang belum dibatalkan.
-- Tidak mengubah/menghapus data lama.

-- CreateTable
CREATE TABLE "investor_profit_share_bulan" (
    "id" TEXT NOT NULL,
    "profitShareId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_profit_share_bulan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investor_profit_share_bulan_profitShareId_idx" ON "investor_profit_share_bulan"("profitShareId");

-- CreateIndex
CREATE INDEX "investor_profit_share_bulan_tenantId_idx" ON "investor_profit_share_bulan"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "investor_profit_share_bulan_investorId_rabProjectId_month_key" ON "investor_profit_share_bulan"("investorId", "rabProjectId", "month");

-- AddForeignKey
ALTER TABLE "investor_profit_share_bulan" ADD CONSTRAINT "investor_profit_share_bulan_profitShareId_fkey" FOREIGN KEY ("profitShareId") REFERENCES "investor_profit_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill dari bagi hasil per proyek yang masih berlaku. Bila data lama sudah dobel,
-- baris pertama (createdAt terlama) yang dicatat; sisanya dilewati ON CONFLICT.
INSERT INTO "investor_profit_share_bulan" ("id", "profitShareId", "investorId", "rabProjectId", "month", "tenantId", "createdAt")
SELECT gen_random_uuid()::text, ps."id", ps."investorId", ps."rabProjectId", bulan.month, ps."tenantId", ps."createdAt"
FROM "investor_profit_shares" ps
CROSS JOIN LATERAL unnest(ps."projectMonths") AS bulan(month)
WHERE ps."rabProjectId" IS NOT NULL
  AND ps."status" <> 'CANCELLED'
ORDER BY ps."createdAt"
ON CONFLICT ("investorId", "rabProjectId", "month") DO NOTHING;
