-- Modul surat pengesahan: satu dokumen PDF yang disahkan beberapa pihak lewat
-- short link privat, hasilnya satu PDF gabungan berisi dokumen asal ditambah
-- halaman tanda tangan.

CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT NOT NULL DEFAULT 'UPLOAD',
    "sourceId" TEXT,
    "sourceFileKey" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceFileHash" TEXT NOT NULL,
    "signedFileKey" TEXT,
    "signedFileHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EndorsementSigner" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "userId" TEXT,
    -- sha256 token short link; token mentah tidak pernah disimpan.
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signatureKey" TEXT,
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndorsementSigner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EndorsementEvent" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "signerId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndorsementEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Endorsement_number_tenantId_key" ON "Endorsement"("number", "tenantId");
CREATE INDEX "Endorsement_tenantId_idx" ON "Endorsement"("tenantId");
CREATE INDEX "Endorsement_status_idx" ON "Endorsement"("status");
CREATE INDEX "Endorsement_createdById_idx" ON "Endorsement"("createdById");
CREATE INDEX "Endorsement_tenantId_status_idx" ON "Endorsement"("tenantId", "status");
CREATE INDEX "Endorsement_expiresAt_idx" ON "Endorsement"("expiresAt");

CREATE UNIQUE INDEX "EndorsementSigner_tokenHash_key" ON "EndorsementSigner"("tokenHash");
CREATE INDEX "EndorsementSigner_endorsementId_idx" ON "EndorsementSigner"("endorsementId");
CREATE INDEX "EndorsementSigner_tenantId_idx" ON "EndorsementSigner"("tenantId");
CREATE INDEX "EndorsementSigner_status_idx" ON "EndorsementSigner"("status");
CREATE INDEX "EndorsementSigner_endorsementId_status_idx" ON "EndorsementSigner"("endorsementId", "status");

CREATE INDEX "EndorsementEvent_endorsementId_createdAt_idx" ON "EndorsementEvent"("endorsementId", "createdAt");
CREATE INDEX "EndorsementEvent_signerId_idx" ON "EndorsementEvent"("signerId");
CREATE INDEX "EndorsementEvent_tenantId_idx" ON "EndorsementEvent"("tenantId");

ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EndorsementSigner" ADD CONSTRAINT "EndorsementSigner_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "Endorsement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EndorsementSigner" ADD CONSTRAINT "EndorsementSigner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EndorsementSigner" ADD CONSTRAINT "EndorsementSigner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EndorsementEvent" ADD CONSTRAINT "EndorsementEvent_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "Endorsement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EndorsementEvent" ADD CONSTRAINT "EndorsementEvent_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "EndorsementSigner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EndorsementEvent" ADD CONSTRAINT "EndorsementEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
