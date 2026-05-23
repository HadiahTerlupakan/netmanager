-- Add actor assignment fields to assets (idempotent)

ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "assignedActorId" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "assignedActorType" TEXT;

CREATE INDEX IF NOT EXISTS "assets_assignedActorType_assignedActorId_idx" ON "assets"("assignedActorType", "assignedActorId");
