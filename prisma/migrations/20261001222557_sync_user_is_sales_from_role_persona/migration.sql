-- Data-only migration: `User.isSales` kini turunan persona role
-- (`role.persona = 'SALES'`), bukan saklar manual. Tidak ada perubahan DDL;
-- komentar `///` kolom isSales di schema.prisma tidak menghasilkan diff.
-- Idempoten: hanya menyentuh baris yang nilainya berbeda.
-- Tinjau dulu dengan laporan pra-deploy:
-- docs/guides/LAPORAN_PRA_DEPLOY_SYNC_IS_SALES_2026-10-02.md

-- User ber-role: samakan dengan persona role-nya.
UPDATE "User" u
SET "isSales" = (r."persona" = 'SALES')
FROM "roles" r
WHERE r."id" = u."roleId"
  AND u."isSales" IS DISTINCT FROM (r."persona" = 'SALES');

-- User tanpa role tidak punya persona → bukan sales (sama dengan aturan aplikasi).
UPDATE "User"
SET "isSales" = false
WHERE "roleId" IS NULL
  AND "isSales" = true;
