-- Rilis produksi aplikasi mobile yang terlihat di Google Play. Tabel baru,
-- global (tanpa tenantId); tidak menyentuh tabel lain.
CREATE TABLE "play_store_releases" (
    "versionCode" INTEGER NOT NULL,
    "versionName" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,

    CONSTRAINT "play_store_releases_pkey" PRIMARY KEY ("versionCode")
);
