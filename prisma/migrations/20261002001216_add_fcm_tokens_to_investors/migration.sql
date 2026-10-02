-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "fcmTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pushTokenUpdatedAt" TIMESTAMP(3);
