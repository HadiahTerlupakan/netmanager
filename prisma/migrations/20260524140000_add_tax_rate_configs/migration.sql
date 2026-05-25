-- CreateEnum
CREATE TYPE "TaxRateCategory" AS ENUM ('PPN', 'PPH', 'BHP_USO', 'OTHER');

-- CreateTable
CREATE TABLE "tax_rate_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TaxRateCategory" NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "dueDay" INTEGER,
    "dueMonth" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_configs_tenantId_code_key" ON "tax_rate_configs"("tenantId", "code");

-- CreateIndex
CREATE INDEX "tax_rate_configs_tenantId_category_idx" ON "tax_rate_configs"("tenantId", "category");

-- CreateIndex
CREATE INDEX "tax_rate_configs_tenantId_isActive_idx" ON "tax_rate_configs"("tenantId", "isActive");
