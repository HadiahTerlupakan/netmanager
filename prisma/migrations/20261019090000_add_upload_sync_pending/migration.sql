-- Berkas yang tersimpan lokal saat R2 gangguan, menunggu diunggah ke R2.
CREATE TABLE "upload_sync_pending" (
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),

    CONSTRAINT "upload_sync_pending_pkey" PRIMARY KEY ("key")
);
