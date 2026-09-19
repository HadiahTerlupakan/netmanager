-- Riwayat perpindahan dana antar akun kas/bank.
--
-- Sebelum tabel ini ada, "Mutasi Saldo" hanya mengubah dua angka saldo: tanggal
-- dan keterangan yang diisi operator tidak tersimpan di mana pun, dan tidak ada
-- yang bisa direkonsiliasi. Baris ditulis dalam transaksi yang sama dengan
-- perubahan saldo.
--
-- Aditif: tidak ada data lama yang disentuh (0 transfer pernah terjadi di
-- produksi, jadi tidak ada backfill yang perlu dilakukan).

-- CreateTable
CREATE TABLE "treasury_mutations" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "sourceAccountId" TEXT NOT NULL,
    "destinationAccountId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,

    CONSTRAINT "treasury_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treasury_mutations_date_idx" ON "treasury_mutations"("date");

-- CreateIndex
CREATE INDEX "treasury_mutations_sourceAccountId_idx" ON "treasury_mutations"("sourceAccountId");

-- CreateIndex
CREATE INDEX "treasury_mutations_destinationAccountId_idx" ON "treasury_mutations"("destinationAccountId");

-- CreateIndex
CREATE INDEX "treasury_mutations_tenantId_idx" ON "treasury_mutations"("tenantId");

-- AddForeignKey
ALTER TABLE "treasury_mutations" ADD CONSTRAINT "treasury_mutations_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_mutations" ADD CONSTRAINT "treasury_mutations_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_mutations" ADD CONSTRAINT "treasury_mutations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_mutations" ADD CONSTRAINT "treasury_mutations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
