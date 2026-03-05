-- CreateEnum
CREATE TYPE "TargetSchema" AS ENUM ('MONTHLY_RESET', 'ACCUMULATED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "targetSchema" "TargetSchema" NOT NULL DEFAULT 'MONTHLY_RESET';

-- AlterTable
ALTER TABLE "point_claims" ADD COLUMN "isCashedOut" BOOLEAN NOT NULL DEFAULT false;
