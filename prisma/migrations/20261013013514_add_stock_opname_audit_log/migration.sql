-- CreateEnum
CREATE TYPE "StockOpnameAuditAksi" AS ENUM ('DIBUAT', 'DIUBAH', 'DIHAPUS');

-- CreateTable
CREATE TABLE "stock_opname_audit_log" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "opnameId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "tenantId" TEXT,
    "aksi" "StockOpnameAuditAksi" NOT NULL,
    "dilakukanOlehId" TEXT,
    "namaPelaku" TEXT NOT NULL,
    "namaBarang" TEXT NOT NULL,
    "perubahan" JSONB,
    "dilakukanPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_opname_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_opname_audit_log_gudangId_dilakukanPada_idx" ON "stock_opname_audit_log"("gudangId", "dilakukanPada");

-- CreateIndex
CREATE INDEX "stock_opname_audit_log_opnameId_idx" ON "stock_opname_audit_log"("opnameId");

-- CreateIndex
CREATE INDEX "stock_opname_audit_log_tenantId_idx" ON "stock_opname_audit_log"("tenantId");

-- AddForeignKey
ALTER TABLE "stock_opname_audit_log" ADD CONSTRAINT "stock_opname_audit_log_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_audit_log" ADD CONSTRAINT "stock_opname_audit_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_audit_log" ADD CONSTRAINT "stock_opname_audit_log_dilakukanOlehId_fkey" FOREIGN KEY ("dilakukanOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
