-- CreateTable
CREATE TABLE "app_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "buildNumber" INTEGER NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "apkUrl" TEXT,
    "apkSize" BIGINT,
    "releaseNotes" TEXT,
    "isForceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "minVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_version_key" ON "app_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_versionCode_key" ON "app_versions"("versionCode");

-- CreateIndex
CREATE INDEX "app_versions_isActive_idx" ON "app_versions"("isActive");

-- CreateIndex
CREATE INDEX "app_versions_platform_idx" ON "app_versions"("platform");

-- CreateIndex
CREATE INDEX "app_versions_versionCode_idx" ON "app_versions"("versionCode");

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
