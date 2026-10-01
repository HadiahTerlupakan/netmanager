-- CreateEnum
CREATE TYPE "PersonaKaryawan" AS ENUM ('STAFF', 'TEKNISI', 'SALES', 'FINANCE', 'DIREKTUR');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "persona" "PersonaKaryawan" NOT NULL DEFAULT 'STAFF';

-- Backfill (idempoten, hanya mengubah role yang masih STAFF bawaan).
-- SALES: role yang dipakai user bertanda sales, atau role kepala sales
-- (memegang presurvei_rencana tanpa view_all — lingkup TIM).
UPDATE "roles" r SET "persona" = 'SALES'
WHERE r."persona" = 'STAFF'
  AND r."isSuperAdmin" = false
  AND (
    EXISTS (SELECT 1 FROM "User" u WHERE u."roleId" = r."id" AND u."isSales" = true)
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
