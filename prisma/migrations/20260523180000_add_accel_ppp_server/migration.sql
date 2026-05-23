-- CreateTable
CREATE TABLE "AccelPppServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "description" TEXT,
    "nasIdentifier" TEXT,
    "radiusSecret" TEXT NOT NULL,
    "authPort" INTEGER NOT NULL DEFAULT 1812,
    "acctPort" INTEGER NOT NULL DEFAULT 1813,
    "coaPort" INTEGER NOT NULL DEFAULT 3799,
    "cliHost" TEXT NOT NULL,
    "cliPort" INTEGER NOT NULL DEFAULT 2001,
    "cliPassword" TEXT,
    "pingStatus" TEXT NOT NULL DEFAULT 'offline',
    "userOnline" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCheck" TIMESTAMP(3),
    "siteId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccelPppServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccelPppServer_pingStatus_idx" ON "AccelPppServer"("pingStatus");

-- CreateIndex
CREATE INDEX "AccelPppServer_siteId_idx" ON "AccelPppServer"("siteId");

-- CreateIndex
CREATE INDEX "AccelPppServer_tenantId_idx" ON "AccelPppServer"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AccelPppServer_tenantId_ipAddress_key" ON "AccelPppServer"("tenantId", "ipAddress");

-- AddForeignKey
ALTER TABLE "AccelPppServer" ADD CONSTRAINT "AccelPppServer_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccelPppServer" ADD CONSTRAINT "AccelPppServer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
