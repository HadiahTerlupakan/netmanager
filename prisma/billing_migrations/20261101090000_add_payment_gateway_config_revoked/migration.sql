-- Sakelar darurat konfigurasi gateway (mis. kredensial bocor): yang dicabut
-- menolak checkout baru, callback, dan cek status. Bawaan false: tidak ada
-- konfigurasi yang berubah perilaku.
ALTER TABLE "PaymentGatewayConfig" ADD COLUMN IF NOT EXISTS "isRevoked" BOOLEAN NOT NULL DEFAULT false;
