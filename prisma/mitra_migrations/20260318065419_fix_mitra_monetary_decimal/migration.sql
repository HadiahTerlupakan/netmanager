-- @safe-guard-ack: ALTER COLUMN Float->Decimal(15,2) untuk field monetary (balance, totalEarnings, totalWithdrawn, amount). Safe karena PostgreSQL auto-cast FLOAT ke DECIMAL tanpa data loss. Sudah ditest di staging.
ALTER TABLE "mitra_wallets" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(15,2);
ALTER TABLE "mitra_wallets" ALTER COLUMN "totalEarnings" SET DATA TYPE DECIMAL(15,2);
ALTER TABLE "mitra_wallets" ALTER COLUMN "totalWithdrawn" SET DATA TYPE DECIMAL(15,2);
ALTER TABLE "mitra_transactions" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(15,2);
