-- Migration data: beri akses penuh menu Presurvei (web) ke role admin produksi.
--
-- Latar: permission `presurvei*` hanya pernah dibuat oleh prisma/seed.ts, yang tidak
-- dijalankan di produksi. Akibatnya di produksi hanya role ber-isSuperAdmin (wildcard
-- "*") yang melihat menu Presurvei. Keputusan user 2026-09-24: akses penuh untuk role
-- admin, Super Admin, Branch Manager, dan KACAB PKP; role SALES tidak diberi akses web.
--
-- Daftar permission = seluruh string presurvei yang dipakai kode (grep
-- "presurvei(_iklan|_target|_laporan)?:<action>" di app/ lib/ modules/).
--
-- Aman dijalankan berulang dan aman di lingkungan mana pun:
--   * Role dicocokkan lewat trim(name): di produksi namanya " Branch Manager"
--     (berspasi di depan). Role yang tidak ada = tidak ada yang ditulis (mis. DB lokal
--     hasil seed memakai nama ADMIN/SUPER_ADMIN).
--   * Permission dibuat per tenant milik role, mengikuti konvensi baris permission
--     produksi (tenantId terisi), dan ON CONFLICT pada unique
--     (resource, action, tenantId) mencegah duplikat.
--   * Relasi role↔permission memakai ON CONFLICT pada primary key ("A","B").
-- Tidak menghapus apa pun; mencabut akses tetap lewat editor Role di admin.

WITH role_sasaran AS (
  SELECT id, "tenantId"
  FROM roles
  WHERE trim(name) IN ('admin', 'Super Admin', 'Branch Manager', 'KACAB PKP')
    AND "tenantId" IS NOT NULL
),
izin(resource, action, name) AS (
  VALUES
    ('presurvei',         'read',   'Read Presurvei'),
    ('presurvei',         'create', 'Create Presurvei'),
    ('presurvei',         'update', 'Update Presurvei'),
    ('presurvei',         'delete', 'Delete Presurvei'),
    ('presurvei_iklan',   'read',   'Read Presurvei_iklan'),
    ('presurvei_iklan',   'create', 'Create Presurvei_iklan'),
    ('presurvei_iklan',   'update', 'Update Presurvei_iklan'),
    ('presurvei_target',  'read',   'Read Presurvei_target'),
    ('presurvei_target',  'create', 'Create Presurvei_target'),
    ('presurvei_laporan', 'read',   'Read Presurvei_laporan')
)
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT gen_random_uuid()::text,
       izin.name,
       izin.action,
       izin.resource,
       'Izinkan ' || izin.action || ' pada ' || izin.resource,
       NOW(),
       NOW(),
       tenant."tenantId"
FROM izin
CROSS JOIN (SELECT DISTINCT "tenantId" FROM role_sasaran) AS tenant
ON CONFLICT (resource, action, "tenantId") DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p.id, r.id
FROM roles r
JOIN "Permission" p ON p."tenantId" = r."tenantId"
WHERE trim(r.name) IN ('admin', 'Super Admin', 'Branch Manager', 'KACAB PKP')
  AND r."tenantId" IS NOT NULL
  AND (p.resource, p.action) IN (
    ('presurvei', 'read'), ('presurvei', 'create'), ('presurvei', 'update'), ('presurvei', 'delete'),
    ('presurvei_iklan', 'read'), ('presurvei_iklan', 'create'), ('presurvei_iklan', 'update'),
    ('presurvei_target', 'read'), ('presurvei_target', 'create'),
    ('presurvei_laporan', 'read')
  )
ON CONFLICT ("A", "B") DO NOTHING;
