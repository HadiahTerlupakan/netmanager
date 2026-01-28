-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'PENDING';
