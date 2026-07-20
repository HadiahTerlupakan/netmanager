-- Make ConversationParticipant.userId and Message.senderId nullable
-- so non-User actors (mitra/pelanggan) can participate without null constraint.
-- FK ke User tetap dipertahankan: hanya nilai non-null yang di-check.

-- Drop unique index/constraint lama (Postgres UNIQUE disimpan sebagai index)
DROP INDEX IF EXISTS "ConversationParticipant_conversationId_userId_key";
ALTER TABLE "ConversationParticipant"
  DROP CONSTRAINT IF EXISTS "ConversationParticipant_conversationId_userId_key";

-- Drop NOT NULL
ALTER TABLE "ConversationParticipant"
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Message"
  ALTER COLUMN "senderId" DROP NOT NULL;
