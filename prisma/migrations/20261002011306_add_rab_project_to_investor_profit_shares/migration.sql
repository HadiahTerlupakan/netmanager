-- DropForeignKey
ALTER TABLE "investor_profit_shares" DROP CONSTRAINT "investor_profit_shares_configId_fkey";

-- AlterTable
ALTER TABLE "investor_profit_shares" ADD COLUMN     "capitalReturnAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rabProjectId" TEXT,
ALTER COLUMN "configId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "investor_profit_shares_rabProjectId_idx" ON "investor_profit_shares"("rabProjectId");

-- AddForeignKey
ALTER TABLE "investor_profit_shares" ADD CONSTRAINT "investor_profit_shares_configId_fkey" FOREIGN KEY ("configId") REFERENCES "investor_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_profit_shares" ADD CONSTRAINT "investor_profit_shares_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
