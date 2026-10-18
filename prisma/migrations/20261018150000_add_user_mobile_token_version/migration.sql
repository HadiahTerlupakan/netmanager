-- Logout mobile mencabut token mobile tanpa mengeluarkan sesi web.
ALTER TABLE "User" ADD COLUMN "mobileTokenVersion" INTEGER NOT NULL DEFAULT 0;
