-- CreateTable
CREATE TABLE "ResellerStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "resellerId" TEXT NOT NULL,
    "fromStatus" "ResellerStatus",
    "toStatus" "ResellerStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResellerStatusHistory_tenantId_resellerId_changedAt_idx" ON "ResellerStatusHistory"("tenantId", "resellerId", "changedAt");

-- AddForeignKey
ALTER TABLE "ResellerStatusHistory" ADD CONSTRAINT "ResellerStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerStatusHistory" ADD CONSTRAINT "ResellerStatusHistory_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
