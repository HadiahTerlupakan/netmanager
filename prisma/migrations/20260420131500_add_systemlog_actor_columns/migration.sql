ALTER TABLE "SystemLog" ADD COLUMN IF NOT EXISTS "actorType" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN IF NOT EXISTS "actorId" TEXT;
CREATE INDEX IF NOT EXISTS "SystemLog_actorType_actorId_idx" ON "SystemLog"("actorType", "actorId");
