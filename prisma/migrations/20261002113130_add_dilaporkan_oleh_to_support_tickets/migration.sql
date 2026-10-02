-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "dilaporkanOlehId" TEXT;

-- CreateIndex
CREATE INDEX "support_tickets_dilaporkanOlehId_status_idx" ON "support_tickets"("dilaporkanOlehId", "status");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_dilaporkanOlehId_fkey" FOREIGN KEY ("dilaporkanOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
