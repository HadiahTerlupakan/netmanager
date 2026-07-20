-- Make ConversationParticipant.userId and Message.senderId nullable
-- so non-User actors (mitra/pelanggan) can participate without FK violation.
-- FK ke User tetap dipertahankan: hanya nilai non-null yang di-check.

-- Drop unique constraint lama (nama aktual di production)
ALTER TABLE "ConversationParticipant"
  DROP CONSTRAINT IF EXISTS "ConversationParticipant_conversationId_userId_key";

-- Drop NOT NULL
ALTER TABLE "ConversationParticipant"
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Message"
  ALTER COLUMN "senderId" DROP NOT NULL;
