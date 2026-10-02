-- Migration data: beri akses penuh Rencana & Penugasan (web) ke role admin produksi.
--
-- Latar: fitur rencana kunjungan (tabel presurvei_rencana, migration
-- 20260926095156_add_presurvei_rencana_and_tim_sales) memakai resource baru
-- `presurvei_rencana`. Role pengelola yang sudah memegang menu Presurvei
-- (20260923211611_grant_presurvei_permissions_to_admin_roles) diberi akses penuh,
-- termasuk `view_all` (melihat & menugaskan ke seluruh sales tenant). Kepala sales
-- dibuat admin lewat template role "Kepala Sales" (tanpa `view_all`).
--
-- Pola sama dengan 20260924180113_grant_mobile_presurvei_permissions_to_sales_role:
--   * NOT EXISTS per tenant, ditambah ON CONFLICT DO NOTHING TANPA target — unique
--     "Permission" berbeda antar-lingkungan (produksi: (resource, action) global;
--     lokal: (resource, action, "tenantId")). ON CONFLICT bertarget gagal 42P10.
--   * Role dicocokkan lewat trim(name) dan "tenantId" IS NOT NULL. Role yang tidak ada
--     = tidak ada yang ditulis.
--   * Relasi role↔permission memakai ON CONFLICT pada primary key ("A","B").
--   * Penautan role↔izin memilih izin tenant yang sama bila ada, selain itu baris
--     (resource, action) yang sudah ada — di produksi unique-nya global sehingga tenant
--     kedua tidak punya baris sendiri (INSERT di atas dilewati ON CONFLICT).
-- Aman dijalankan berulang. Tidak menghapus apa pun.

WITH role_sasaran AS (
  SELECT DISTINCT "tenantId"
  FROM roles
  WHERE trim(name) IN ('admin', 'Super Admin', 'Branch Manager', 'KACAB PKP')
    AND "tenantId" IS NOT NULL
),
izin(resource, action, name) AS (
  VALUES
    ('presurvei_rencana', 'read',     'Read Presurvei_rencana'),
    ('presurvei_rencana', 'create',   'Create Presurvei_rencana'),
    ('presurvei_rencana', 'update',   'Update Presurvei_rencana'),
    ('presurvei_rencana', 'view_all', 'View_all Presurvei_rencana')
)
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT gen_random_uuid()::text,
       izin.name,
       izin.action,
       izin.resource,
       'Izinkan ' || izin.action || ' pada ' || izin.resource,
       NOW(),
       NOW(),
       role_sasaran."tenantId"
FROM izin
CROSS JOIN role_sasaran
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p.resource = izin.resource
    AND p.action = izin.action
    AND p."tenantId" = role_sasaran."tenantId"
)
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p.id, r.id
FROM roles r
CROSS JOIN (
  VALUES ('presurvei_rencana', 'read'), ('presurvei_rencana', 'create'),
         ('presurvei_rencana', 'update'), ('presurvei_rencana', 'view_all')
) AS izin(resource, action)
JOIN LATERAL (
  SELECT q.id FROM "Permission" q
  WHERE q.resource = izin.resource AND q.action = izin.action
  ORDER BY (q."tenantId" = r."tenantId") DESC NULLS LAST, q."createdAt"
  LIMIT 1
) p ON true
WHERE trim(r.name) IN ('admin', 'Super Admin', 'Branch Manager', 'KACAB PKP')
  AND r."tenantId" IS NOT NULL
ON CONFLICT ("A", "B") DO NOTHING;
