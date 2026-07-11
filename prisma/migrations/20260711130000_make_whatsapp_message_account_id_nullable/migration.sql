-- Make WhatsAppMessage.accountId nullable so deleting a WhatsAppAccount
-- preserves message history (audit log). FK constraint changed from
-- Restrict to SetNull.

-- Drop existing Restrict FK, replace with SetNull, alter column to nullable.
ALTER TABLE "WhatsAppMessage" DROP CONSTRAINT "WhatsAppMessage_accountId_fkey";

ALTER TABLE "WhatsAppMessage" ALTER COLUMN "accountId" DROP NOT NULL;

ALTER TABLE "WhatsAppMessage"
  ADD CONSTRAINT "WhatsAppMessage_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id")
  ON DELETE SET NULL;