-- AlterTable: Tambah kolom tokenVersion ke Mitra untuk refresh token revocation.
-- Tanpa kolom ini, refresh token Mitra tidak dapat di-revoke server-side
-- saat logout (lihat /api/mobile/auth/logout). Default 0 sesuai pattern
-- yang sebelumnya hardcoded di lib/mobile-auth.ts.

ALTER TABLE "Mitra" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
