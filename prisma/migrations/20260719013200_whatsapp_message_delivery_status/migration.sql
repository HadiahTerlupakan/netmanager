-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_messageId_idx" ON "WhatsAppMessage"("messageId");
