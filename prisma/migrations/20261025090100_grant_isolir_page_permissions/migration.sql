-- Migration data: beri akses Halaman Isolir ke role yang sudah mengelola Pengaturan.
--
-- Latar: menu Halaman Isolir memakai resource baru `isolir_page`. Seed
-- (prisma/seed.ts) tidak berjalan di produksi, jadi tanpa migration ini tidak
-- ada admin tenant yang bisa membuka menunya. Sasarannya setiap role tenant
-- yang sudah memegang `logo` `update` (mereka sudah mengelola Pengaturan),
-- bukan daftar nama role yang ditulis tetap.
--
-- Pola sama dengan 20260926100438_grant_presurvei_rencana_permissions_to_admin_roles:
--   * NOT EXISTS per tenant, ditambah ON CONFLICT DO NOTHING TANPA target — unique
--     "Permission" berbeda antar-lingkungan (produksi: (resource, action) global;
--     lokal: (resource, action, "tenantId")). ON CONFLICT bertarget gagal 42P10.
--   * Relasi role↔permission memakai ON CONFLICT pada primary key ("A","B").
--   * Penautan role↔izin memilih izin tenant yang sama bila ada, selain itu baris
--     (resource, action) yang sudah ada — di produksi unique-nya global sehingga tenant
--     kedua tidak punya baris sendiri (INSERT di atas dilewati ON CONFLICT).
-- Aman dijalankan berulang. Tidak menghapus apa pun.

WITH role_sasaran AS (
  SELECT DISTINCT r.id, r."tenantId"
  FROM roles r
  JOIN "_PermissionToRole" pr ON pr."B" = r.id
  JOIN "Permission" p ON p.id = pr."A"
  WHERE p.resource = 'logo'
    AND p.action = 'update'
    AND r."tenantId" IS NOT NULL
),
izin(resource, action, name) AS (
  VALUES
    ('isolir_page', 'read',   'Read Isolir_page'),
    ('isolir_page', 'update', 'Update Isolir_page')
)
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT gen_random_uuid()::text,
       izin.name,
       izin.action,
       izin.resource,
       'Izinkan ' || izin.action || ' pada ' || izin.resource,
       NOW(),
       NOW(),
       t."tenantId"
FROM izin
CROSS JOIN (SELECT DISTINCT "tenantId" FROM role_sasaran) t
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p.resource = izin.resource
    AND p.action = izin.action
    AND p."tenantId" = t."tenantId"
)
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
WITH role_sasaran AS (
  SELECT DISTINCT r.id, r."tenantId"
  FROM roles r
  JOIN "_PermissionToRole" pr ON pr."B" = r.id
  JOIN "Permission" p ON p.id = pr."A"
  WHERE p.resource = 'logo'
    AND p.action = 'update'
    AND r."tenantId" IS NOT NULL
)
SELECT p.id, rs.id
FROM role_sasaran rs
CROSS JOIN (
  VALUES ('isolir_page', 'read'), ('isolir_page', 'update')
) AS izin(resource, action)
JOIN LATERAL (
  SELECT q.id FROM "Permission" q
  WHERE q.resource = izin.resource AND q.action = izin.action
  ORDER BY (q."tenantId" = rs."tenantId") DESC NULLS LAST, q."createdAt"
  LIMIT 1
) p ON true
ON CONFLICT ("A", "B") DO NOTHING;
