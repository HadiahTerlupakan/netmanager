-- CreateTable: app_releases untuk distribusi APK langsung (non-OTA)
CREATE TABLE "app_releases" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "isForceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "minSupportedVersion" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "architecture" TEXT,
    "minOsVersion" TEXT,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
    "apkSizeBytes" BIGINT,
    "tenantId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_releases_platform_isActive_releasedAt_idx" ON "app_releases"("platform", "isActive", "releasedAt");

-- CreateIndex
CREATE INDEX "app_releases_platform_architecture_isActive_idx" ON "app_releases"("platform", "architecture", "isActive");

-- CreateIndex
CREATE INDEX "app_releases_tenantId_idx" ON "app_releases"("tenantId");

-- AlterTable: tambah field contact admin ke TenantSettings
ALTER TABLE "TenantSettings" ADD COLUMN "appUpdateContactUrl" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN "appUpdateContactLabel" TEXT;
