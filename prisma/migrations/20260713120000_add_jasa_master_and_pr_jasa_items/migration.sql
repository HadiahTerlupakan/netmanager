-- CreateTable
CREATE TABLE "jasa" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "satuan" TEXT NOT NULL DEFAULT 'job',
    "supplierId" TEXT,
    "hargaEstimasi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kategoriPph" TEXT,
    "deskripsi" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "jasa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_jasa_items" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "jasaId" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 1,
    "hargaPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHarga" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "tanggalSelesai" TIMESTAMP(3),
    "buktiSelesai" TEXT[],
    "statusKonfirmasi" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "purchase_request_jasa_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jasa_tenantId_idx" ON "jasa"("tenantId");

-- CreateIndex
CREATE INDEX "jasa_status_idx" ON "jasa"("status");

-- CreateIndex
CREATE INDEX "jasa_supplierId_idx" ON "jasa"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "tenantId_kode_jasa" ON "jasa"("tenantId", "kode");

-- CreateIndex
CREATE INDEX "purchase_request_jasa_items_tenantId_idx" ON "purchase_request_jasa_items"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_request_jasa_items_purchaseRequestId_idx" ON "purchase_request_jasa_items"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "purchase_request_jasa_items_jasaId_idx" ON "purchase_request_jasa_items"("jasaId");

-- CreateIndex
CREATE INDEX "purchase_request_jasa_items_statusKonfirmasi_idx" ON "purchase_request_jasa_items"("statusKonfirmasi");

-- AddForeignKey
ALTER TABLE "jasa" ADD CONSTRAINT "jasa_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jasa" ADD CONSTRAINT "jasa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_jasa_items" ADD CONSTRAINT "purchase_request_jasa_items_jasaId_fkey" FOREIGN KEY ("jasaId") REFERENCES "jasa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_jasa_items" ADD CONSTRAINT "purchase_request_jasa_items_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_jasa_items" ADD CONSTRAINT "purchase_request_jasa_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
