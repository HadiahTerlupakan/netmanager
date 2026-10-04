-- CreateTable
CREATE TABLE "LegalCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "confidentiality" TEXT NOT NULL DEFAULT 'BIASA',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "categoryId" TEXT,
    "documentNumber" TEXT,
    "partyName" TEXT,
    "partyType" TEXT,
    "partyId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "value" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "paymentScheme" TEXT,
    "guaranteeDescription" TEXT,
    "guaranteeEndDate" TIMESTAMP(3),
    "isAutoRenew" BOOLEAN NOT NULL DEFAULT false,
    "noticePeriodDays" INTEGER,
    "penaltyNotes" TEXT,
    "disputeResolution" TEXT,
    "notes" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileContentType" TEXT NOT NULL,
    "picUserId" TEXT,
    "endorsementId" TEXT,
    "previousDocumentId" TEXT,
    "createdById" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalObligation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalReminderLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "deadlineKey" TEXT NOT NULL,
    "threshold" TEXT NOT NULL,
    "tenantId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalCategory_tenantId_idx" ON "LegalCategory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalCategory_tenantId_name_key" ON "LegalCategory"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_previousDocumentId_key" ON "LegalDocument"("previousDocumentId");

-- CreateIndex
CREATE INDEX "LegalDocument_tenantId_idx" ON "LegalDocument"("tenantId");

-- CreateIndex
CREATE INDEX "LegalDocument_tenantId_documentType_idx" ON "LegalDocument"("tenantId", "documentType");

-- CreateIndex
CREATE INDEX "LegalDocument_categoryId_idx" ON "LegalDocument"("categoryId");

-- CreateIndex
CREATE INDEX "LegalDocument_endDate_idx" ON "LegalDocument"("endDate");

-- CreateIndex
CREATE INDEX "LegalDocument_picUserId_idx" ON "LegalDocument"("picUserId");

-- CreateIndex
CREATE INDEX "LegalObligation_documentId_idx" ON "LegalObligation"("documentId");

-- CreateIndex
CREATE INDEX "LegalObligation_tenantId_idx" ON "LegalObligation"("tenantId");

-- CreateIndex
CREATE INDEX "LegalReminderLog_tenantId_idx" ON "LegalReminderLog"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalReminderLog_documentId_deadlineKey_threshold_key" ON "LegalReminderLog"("documentId", "deadlineKey", "threshold");

-- AddForeignKey
ALTER TABLE "LegalCategory" ADD CONSTRAINT "LegalCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LegalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_previousDocumentId_fkey" FOREIGN KEY ("previousDocumentId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalObligation" ADD CONSTRAINT "LegalObligation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalObligation" ADD CONSTRAINT "LegalObligation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalReminderLog" ADD CONSTRAINT "LegalReminderLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalReminderLog" ADD CONSTRAINT "LegalReminderLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
