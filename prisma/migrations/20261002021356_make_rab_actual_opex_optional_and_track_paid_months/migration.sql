-- @safe-guard-ack: ALTER COLUMN "actualOpex" DROP NOT NULL/DROP DEFAULT hanya melonggarkan constraint. UPDATE mengubah actualOpex 0 → NULL: form admin tidak pernah mengirim OPEX aktual (API mengisi 0 otomatis), jadi 0 lama berarti "belum diisi" dan hitungan RAB tetap memakai OPEX rencana seperti sebelumnya. Tidak ada DROP TABLE/DROP COLUMN/TRUNCATE.
-- AlterTable
ALTER TABLE "investor_profit_shares" ADD COLUMN     "projectMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "rab_actual_achievements" ALTER COLUMN "actualOpex" DROP NOT NULL,
ALTER COLUMN "actualOpex" DROP DEFAULT;

-- Backfill: form admin tidak pernah mengirim OPEX aktual, API mengisinya 0 secara
-- default. Nilai 0 lama berarti "belum diisi" → NULL agar hitungan memakai OPEX
-- rencana RAB (perilaku yang selama ini berlaku). Tidak ada nilai OPEX nyata yang hilang.
UPDATE "rab_actual_achievements" SET "actualOpex" = NULL WHERE "actualOpex" = 0;
