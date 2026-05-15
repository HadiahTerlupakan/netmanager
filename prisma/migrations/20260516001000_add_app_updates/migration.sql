-- Tabel app_updates untuk Expo Updates OTA bundles.
-- Mobile (expo-updates) hit /api/mobile/manifest dengan headers
-- expo-runtime-version + expo-platform + expo-channel-name.
-- Server pilih row aktif terbaru per (channel, runtimeVersion, platform).

CREATE TABLE "app_updates" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "bundlePath" TEXT NOT NULL,
    "bundleSize" BIGINT NOT NULL,
    "assets" JSONB NOT NULL,
    "metadata" JSONB,
    "signature" TEXT,
    "signatureKeyId" TEXT,
    "releaseNotes" TEXT,
    "commitTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_updates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_updates_manifestId_key" ON "app_updates"("manifestId");

-- Index utama untuk query manifest lookup. Sort desc commitTime supaya paling baru di depan.
CREATE INDEX "idx_app_updates_lookup" ON "app_updates"
  ("channel", "runtimeVersion", "platform", "isActive", "commitTime" DESC);

CREATE INDEX "app_updates_tenantId_idx" ON "app_updates"("tenantId");
