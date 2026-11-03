-- @safe-guard-ack: ALTER COLUMN rate INTEGER → DECIMAL(5,2) hanya melebarkan tipe (nilai lama 1–100 tetap utuh). Produksi 2026-11-03: 0 baris ResellerCommissionRule/ResellerCommission. Tidak ada DROP TABLE/DROP COLUMN/TRUNCATE.
/*
  Warnings:

  - You are about to alter the column `rate` on the `ResellerCommission` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to alter the column `rate` on the `ResellerCommissionRule` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE "ResellerCommission" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "ResellerCommissionRule" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(5,2);
