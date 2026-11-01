-- Token FCM aplikasi mobile pelanggan. Sejak 2026-04-16 aplikasi hanya
-- mendaftarkan token FCM, tetapi Pelanggan hanya punya `pushToken` (token Expo
-- lama), sehingga token pelanggan tidak pernah tersimpan dan push pelanggan
-- tidak sampai ke aplikasi yang sekarang.
ALTER TABLE "Pelanggan" ADD COLUMN "fcmTokens" TEXT[] DEFAULT ARRAY[]::TEXT[];
