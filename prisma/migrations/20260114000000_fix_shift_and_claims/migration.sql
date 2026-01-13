-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PointClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "point_claims" (
    "id" TEXT NOT NULL,
    "canvasingId" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "buktiUrls" TEXT[],
    "buktiMetadata" JSONB,
    "keterangan" TEXT,
    "pointValue" INTEGER NOT NULL DEFAULT 2,
    "status" "PointClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Shift_code_key" ON "Shift"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shift_isActive_idx" ON "Shift"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "point_claims_canvasingId_key" ON "point_claims"("canvasingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "point_claims_canvasingId_idx" ON "point_claims"("canvasingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "point_claims_salesId_idx" ON "point_claims"("salesId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "point_claims_status_idx" ON "point_claims"("status");

-- AlterTable Canvasing
ALTER TABLE "canvasing" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;

-- AddForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_shiftId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_claims" DROP CONSTRAINT IF EXISTS "point_claims_canvasingId_fkey";
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_canvasingId_fkey" FOREIGN KEY ("canvasingId") REFERENCES "canvasing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_claims" DROP CONSTRAINT IF EXISTS "point_claims_salesId_fkey";
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_claims" DROP CONSTRAINT IF EXISTS "point_claims_reviewedById_fkey";
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
