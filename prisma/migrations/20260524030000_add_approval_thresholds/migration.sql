-- Approval matrix per role × scope × nominal range. Saat approve PR/PO,
-- guard memastikan role approver punya threshold yang cover nominal.
-- `maxAmount` null = tidak ada batas atas (untuk role tertinggi).

CREATE TYPE "ApprovalThresholdScope" AS ENUM (
  'PURCHASE_REQUEST',
  'PURCHASE_ORDER'
);

CREATE TABLE "approval_thresholds" (
  "id" TEXT NOT NULL,
  "scope" "ApprovalThresholdScope" NOT NULL,
  "roleId" TEXT NOT NULL,
  "minAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxAmount" DOUBLE PRECISION,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT,

  CONSTRAINT "approval_thresholds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_thresholds_tenantId_scope_isActive_idx"
  ON "approval_thresholds"("tenantId", "scope", "isActive");
CREATE INDEX "approval_thresholds_roleId_idx"
  ON "approval_thresholds"("roleId");

ALTER TABLE "approval_thresholds"
  ADD CONSTRAINT "approval_thresholds_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_thresholds"
  ADD CONSTRAINT "approval_thresholds_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
