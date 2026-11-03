-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResellerStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "ResellerStatus" ADD VALUE 'TERMINATED';

-- AlterTable
ALTER TABLE "Reseller" ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "kbliCode" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "licenseVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "licenseVerifiedById" TEXT,
ADD COLUMN     "nib" TEXT,
ADD COLUMN     "standardCertificateNumber" TEXT,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedById" TEXT,
ADD COLUMN     "statusReason" TEXT;
