-- CreateTable
CREATE TABLE "LegalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "categoryId" TEXT,
    "content" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalTemplate_tenantId_idx" ON "LegalTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalTemplate_tenantId_name_key" ON "LegalTemplate"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "LegalTemplate" ADD CONSTRAINT "LegalTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LegalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTemplate" ADD CONSTRAINT "LegalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
