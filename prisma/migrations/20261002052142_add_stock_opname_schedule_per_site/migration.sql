-- CreateTable
CREATE TABLE "stock_opname_aturan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "tanggalMulai" INTEGER NOT NULL DEFAULT 25,
    "tanggalSelesai" INTEGER NOT NULL DEFAULT 31,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "stock_opname_aturan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname_jadwal" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "tanggalMulai" DATE NOT NULL,
    "tanggalSelesai" DATE NOT NULL,
    "catatan" TEXT,
    "diubahOlehId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "stock_opname_jadwal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_aturan_siteId_key" ON "stock_opname_aturan"("siteId");

-- CreateIndex
CREATE INDEX "stock_opname_aturan_tenantId_idx" ON "stock_opname_aturan"("tenantId");

-- CreateIndex
CREATE INDEX "stock_opname_jadwal_tenantId_idx" ON "stock_opname_jadwal"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_jadwal_siteId_periode_key" ON "stock_opname_jadwal"("siteId", "periode");

-- AddForeignKey
ALTER TABLE "stock_opname_aturan" ADD CONSTRAINT "stock_opname_aturan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_aturan" ADD CONSTRAINT "stock_opname_aturan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_jadwal" ADD CONSTRAINT "stock_opname_jadwal_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_jadwal" ADD CONSTRAINT "stock_opname_jadwal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
