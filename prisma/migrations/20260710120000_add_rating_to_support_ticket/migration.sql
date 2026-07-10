-- AlterTable: add nullable rating column to support_tickets
ALTER TABLE "support_tickets" ADD COLUMN "rating" INTEGER;

-- CreateIndex: composite index for filtered queries (status + rating)
CREATE INDEX "support_tickets_status_rating_idx" ON "support_tickets"("status", "rating");
