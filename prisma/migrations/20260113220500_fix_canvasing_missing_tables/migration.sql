-- CreateEnum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PointClaimStatus') THEN
        CREATE TYPE "PointClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
END $$;

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
CREATE UNIQUE INDEX IF NOT EXISTS "point_claims_canvasingId_key" ON "point_claims"("canvasingId");
CREATE INDEX IF NOT EXISTS "point_claims_canvasingId_idx" ON "point_claims"("canvasingId");
CREATE INDEX IF NOT EXISTS "point_claims_salesId_idx" ON "point_claims"("salesId");
CREATE INDEX IF NOT EXISTS "point_claims_status_idx" ON "point_claims"("status");

-- AlterTable: Add columns safely
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='canvasing' AND column_name='fotoKtp') THEN
        ALTER TABLE "canvasing" ADD COLUMN "fotoKtp" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='canvasing' AND column_name='isLocked') THEN
        ALTER TABLE "canvasing" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='canvasing' AND column_name='workOrderId') THEN
        ALTER TABLE "canvasing" ADD COLUMN "workOrderId" TEXT;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_claims_canvasingId_fkey') THEN
        ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_canvasingId_fkey" FOREIGN KEY ("canvasingId") REFERENCES "canvasing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_claims_salesId_fkey') THEN
        ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_claims_reviewedById_fkey') THEN
        ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canvasing_workOrderId_fkey') THEN
        ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
