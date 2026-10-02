-- Data-only migration: `User.isSales` kini turunan persona role
-- (`role.persona = 'SALES'`), bukan saklar manual. Tidak ada perubahan DDL;
-- komentar `///` kolom isSales di schema.prisma tidak menghasilkan diff.
-- Idempoten: hanya menyentuh baris yang nilainya berbeda.
-- Tinjau dulu dengan laporan pra-deploy:
-- docs/reports/LAPORAN_PRA_DEPLOY_SYNC_IS_SALES_2026-10-02.md

-- Pertahankan hak cairkan bonus canvasing. Sebelumnya hak itu datang dari
-- isSales per user; teknisi/manajer yang kadang canvasing (contoh produksi: role
-- Teknisi & Branch Manager punya user ber-isSales) akan kehilangan isSales di
-- bawah. Role non-SALES yang memegang m_canvasing dan punya user AKTIF
-- ber-isSales diberi izin m_canvasing:cashout lebih dulu. Idempoten.
WITH role_sasaran AS (
  SELECT DISTINCT r."id", r."tenantId"
  FROM "roles" r
  JOIN "User" u ON u."roleId" = r."id" AND u."isSales" = true AND u."isActive" = true
  WHERE r."persona" <> 'SALES'
    AND r."tenantId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" p ON p."id" = pr."A"
      WHERE pr."B" = r."id" AND p."resource" = 'm_canvasing'
    )
)
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT gen_random_uuid()::text, 'Cashout M_canvasing', 'cashout', 'm_canvasing',
       'Izinkan cairkan bonus canvasing', NOW(), NOW(), t."tenantId"
FROM (SELECT DISTINCT "tenantId" FROM role_sasaran) t
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" p
  WHERE p."resource" = 'm_canvasing' AND p."action" = 'cashout' AND p."tenantId" = t."tenantId"
)
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "roles" r
JOIN "Permission" p ON p."tenantId" = r."tenantId" AND p."resource" = 'm_canvasing' AND p."action" = 'cashout'
WHERE r."persona" <> 'SALES'
  AND r."tenantId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "User" u WHERE u."roleId" = r."id" AND u."isSales" = true AND u."isActive" = true)
  AND EXISTS (
    SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" q ON q."id" = pr."A"
    WHERE pr."B" = r."id" AND q."resource" = 'm_canvasing'
  )
ON CONFLICT DO NOTHING;

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
