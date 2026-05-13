-- Phase 8 Observability: EmailDeliveryLog + NotificationDeadLetter

CREATE TABLE "EmailDeliveryLog" (
  "id"        TEXT NOT NULL,
  "to"        TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "status"    TEXT NOT NULL,
  "provider"  TEXT NOT NULL DEFAULT 'SMTP',
  "messageId" TEXT,
  "error"     TEXT,
  "sentAt"    TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  "tenantId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDeliveryLog_status_idx"    ON "EmailDeliveryLog"("status");
CREATE INDEX "EmailDeliveryLog_to_idx"        ON "EmailDeliveryLog"("to");
CREATE INDEX "EmailDeliveryLog_tenantId_idx"  ON "EmailDeliveryLog"("tenantId");
CREATE INDEX "EmailDeliveryLog_createdAt_idx" ON "EmailDeliveryLog"("createdAt");

ALTER TABLE "EmailDeliveryLog"
  ADD CONSTRAINT "EmailDeliveryLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------------------------------------------

CREATE TABLE "NotificationDeadLetter" (
  "id"            TEXT NOT NULL,
  "channel"       TEXT NOT NULL,
  "pelangganId"   TEXT NOT NULL,
  "templateKey"   TEXT NOT NULL,
  "params"        JSONB NOT NULL,
  "error"         TEXT NOT NULL,
  "attemptCount"  INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "resolvedAt"    TIMESTAMP(3),
  "tenantId"      TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationDeadLetter_channel_createdAt_idx" ON "NotificationDeadLetter"("channel", "createdAt");
CREATE INDEX "NotificationDeadLetter_pelangganId_idx"       ON "NotificationDeadLetter"("pelangganId");
CREATE INDEX "NotificationDeadLetter_tenantId_idx"          ON "NotificationDeadLetter"("tenantId");
CREATE INDEX "NotificationDeadLetter_resolvedAt_idx"        ON "NotificationDeadLetter"("resolvedAt");

ALTER TABLE "NotificationDeadLetter"
  ADD CONSTRAINT "NotificationDeadLetter_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
