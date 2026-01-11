-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastVersionCode" INTEGER,
ADD COLUMN     "lastVersionName" TEXT,
ADD COLUMN     "lastVersionUpdate" TIMESTAMP(3);
