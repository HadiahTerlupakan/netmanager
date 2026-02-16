-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN     "lastVersionCode" INTEGER,
ADD COLUMN     "lastVersionName" TEXT,
ADD COLUMN     "lastVersionUpdate" TIMESTAMP(3),
ADD COLUMN     "pushToken" TEXT,
ADD COLUMN     "pushTokenUpdatedAt" TIMESTAMP(3);
