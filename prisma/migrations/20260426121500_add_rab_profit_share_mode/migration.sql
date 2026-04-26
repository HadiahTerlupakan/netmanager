CREATE TYPE "RabInvestorProfitShareMode" AS ENUM ('FLAT', 'TIERED_AFTER_BEP');

ALTER TABLE "rab_projects"
  ADD COLUMN "investorProfitShareMode" "RabInvestorProfitShareMode" NOT NULL DEFAULT 'FLAT',
  ADD COLUMN "investorProfitShareBeforeBepPercent" DOUBLE PRECISION NOT NULL DEFAULT 80,
  ADD COLUMN "investorProfitShareAfterBepPercent" DOUBLE PRECISION NOT NULL DEFAULT 60;
