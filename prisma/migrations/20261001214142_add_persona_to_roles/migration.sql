-- CreateEnum
CREATE TYPE "PersonaKaryawan" AS ENUM ('STAFF', 'TEKNISI', 'SALES', 'FINANCE', 'DIREKTUR');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "persona" "PersonaKaryawan" NOT NULL DEFAULT 'STAFF';

-- Backfill (idempoten, hanya mengubah role yang masih STAFF bawaan).
-- SALES: role yang memegang presurvei mobile (m_presurvei), atau role kepala
-- sales (presurvei_rencana tanpa view_all — lingkup TIM).
--
-- Sengaja TIDAK memakai "ada user ber-isSales" sebagai penanda: di produksi role
-- Teknisi (35 user) punya 5 user ber-isSales warisan, sehingga seluruh teknisi
-- ikut menjadi SALES (lalu isSales mereka disinkron true oleh migration
-- berikutnya) dan aplikasi mereka berganti ke tampilan sales.
UPDATE "roles" r SET "persona" = 'SALES'
WHERE r."persona" = 'STAFF'
  AND r."isSuperAdmin" = false
  AND (
    EXISTS (
      SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" p ON p."id" = pr."A"
      WHERE pr."B" = r."id" AND p."resource" = 'm_presurvei'
    )
    OR (
      EXISTS (
        SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" p ON p."id" = pr."A"
        WHERE pr."B" = r."id" AND p."resource" = 'presurvei_rencana'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" p ON p."id" = pr."A"
        WHERE pr."B" = r."id" AND p."resource" = 'presurvei_rencana' AND p."action" = 'view_all'
      )
    )
  );

-- TEKNISI: role lain yang memegang izin work order di aplikasi mobile.
UPDATE "roles" r SET "persona" = 'TEKNISI'
WHERE r."persona" = 'STAFF'
  AND r."isSuperAdmin" = false
  AND EXISTS (
    SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" p ON p."id" = pr."A"
    WHERE pr."B" = r."id" AND p."resource" = 'm_work_order'
  );

-- Sisanya tetap STAFF. FINANCE dan DIREKTUR diatur manual lewat form role.
