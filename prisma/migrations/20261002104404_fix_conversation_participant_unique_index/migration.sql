-- Ganti unique index PARSIAL (WHERE "actorId" IS NOT NULL) dengan unique index penuh.
--
-- `upsert` Prisma pada @@unique([conversationId, actorType, actorId]) menghasilkan
-- `ON CONFLICT ("conversationId","actorType","actorId")`, yang tidak bisa memakai
-- index parsial (Postgres 42P10: no unique or exclusion constraint matching the
-- ON CONFLICT specification) → GET /api/(admin|mobile)/chat/global selalu 500.
--
-- Aman tanpa ubah data: NULL dianggap berbeda oleh unique index Postgres, jadi
-- baris ber-actorId NULL tetap boleh lebih dari satu (sama dengan index parsial),
-- dan duplikat ber-actorId terisi tidak mungkin ada karena index lama sudah
-- mencegahnya. Nama index sama dengan `map:` di schema.prisma.
DROP INDEX IF EXISTS "ConversationParticipant_conversation_actorType_actorId_key";

CREATE UNIQUE INDEX "ConversationParticipant_conversation_actorType_actorId_key"
  ON "ConversationParticipant"("conversationId", "actorType", "actorId");
