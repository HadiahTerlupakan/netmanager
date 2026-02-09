-- CreateEnum
CREATE TYPE "RabExpenseType" AS ENUM ('CAPEX', 'OPEX');

-- CreateEnum
CREATE TYPE "RabGrowthType" AS ENUM ('LINEAR', 'PERCENTAGE', 'CUSTOM');

-- AlterTable
ALTER TABLE "rab_items" ADD COLUMN     "expenseType" "RabExpenseType" NOT NULL DEFAULT 'CAPEX';

-- AlterTable
ALTER TABLE "rab_projects" ADD COLUMN     "arpu" BIGINT,
ADD COLUMN     "growthSettings" JSONB,
ADD COLUMN     "growthType" "RabGrowthType" NOT NULL DEFAULT 'LINEAR',
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "targetSubscribers" INTEGER;

-- AlterTable
ALTER TABLE "stock_opname" ADD COLUMN     "alasanSelisih" TEXT;
