-- Additive migration: introduce actorType/actorId on ConversationParticipant & Message
-- to support non-User actors (mitra, pelanggan) in chat.
-- userId/senderId tetap NOT NULL sementara + FK ke User tetap aktif (safety net).
-- Backfill actorId dari existing userId/senderId, actorType default 'user'.
-- Unique constraint lama diganti partial unique index pada (conversationId, actorType, actorId)
-- karena Postgres memperlakukan NULL sebagai distinct (nullable userId tidak enforce).

-- AlterTable: ConversationParticipant
ALTER TABLE "ConversationParticipant"
  ADD COLUMN IF NOT EXISTS "actorType" TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "actorId"   TEXT;

-- AlterTable: Message
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "actorType" TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "actorId"   TEXT;

-- Backfill actorId dari existing userId/senderId
UPDATE "ConversationParticipant" SET "actorId" = "userId" WHERE "actorId" IS NULL;
UPDATE "Message" SET "actorId" = "senderId" WHERE "actorId" IS NULL;

-- Drop unique constraint lama pada ConversationParticipant(conversationId, userId)
ALTER TABLE "ConversationParticipant"
  DROP CONSTRAINT IF EXISTS "conversationparticipant_conversation_userId_unique";

-- Partial unique index: enforce (conversationId, actorType, actorId) hanya ketika actorId NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationParticipant_conversation_actorType_actorId_key"
  ON "ConversationParticipant"("conversationId", "actorType", "actorId")
  WHERE "actorId" IS NOT NULL;

-- Index untuk query actor-based lookup
CREATE INDEX IF NOT EXISTS "ConversationParticipant_actorType_actorId_idx"
  ON "ConversationParticipant"("actorType", "actorId");
CREATE INDEX IF NOT EXISTS "Message_actorType_actorId_idx"
  ON "Message"("actorType", "actorId");