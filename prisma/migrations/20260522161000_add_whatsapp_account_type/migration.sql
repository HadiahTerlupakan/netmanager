-- Add accountType column + index to WhatsAppAccount (idempotent)

ALTER TABLE "WhatsAppAccount" ADD COLUMN IF NOT EXISTS "accountType" TEXT NOT NULL DEFAULT 'CUSTOMER';

CREATE INDEX IF NOT EXISTS "WhatsAppAccount_accountType_idx" ON "WhatsAppAccount"("accountType");
