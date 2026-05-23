-- Add (actorType, actorId) composite index to inventory tables (idempotent)

CREATE INDEX IF NOT EXISTS "barang_keluar_actorType_actorId_idx" ON "barang_keluar"("actorType", "actorId");
CREATE INDEX IF NOT EXISTS "barang_masuk_actorType_actorId_idx" ON "barang_masuk"("actorType", "actorId");
