-- Idempotent: only create tables if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WhatsAppAccount') THEN
    CREATE TABLE "WhatsAppAccount" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "apiKey" TEXT NOT NULL,
        "domain" TEXT,
        "deviceId" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "priority" INTEGER NOT NULL DEFAULT 0,
        "dailyLimit" INTEGER,
        "dailyCount" INTEGER NOT NULL DEFAULT 0,
        "lastReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "tenantId" TEXT,

        CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WhatsAppMessage') THEN
    CREATE TABLE "WhatsAppMessage" (
        "id" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "message" TEXT,
        "fileUrl" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "error" TEXT,
        "messageId" TEXT,
        "response" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "sentAt" TIMESTAMP(3),
        "tenantId" TEXT,

        CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "WhatsAppAccount_tenantId_isActive_idx" ON "WhatsAppAccount"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "WhatsAppAccount_isDefault_idx" ON "WhatsAppAccount"("isDefault");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppAccount_phone_tenantId_key" ON "WhatsAppAccount"("phone", "tenantId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_accountId_idx" ON "WhatsAppMessage"("accountId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_tenantId_idx" ON "WhatsAppMessage"("tenantId");

-- AddForeignKey (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppAccount_tenantId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppMessage_accountId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppMessage_tenantId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
