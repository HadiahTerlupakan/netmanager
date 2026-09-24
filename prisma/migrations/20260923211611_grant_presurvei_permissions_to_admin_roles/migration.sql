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
-- Sengaja TIDAK memakai ON CONFLICT untuk "Permission". Unique constraint tabel itu
-- berbeda antar-lingkungan: riwayat migration membuat (resource, action, tenantId),
-- tetapi produksi masih memakai (resource, action) karena
-- 20260315020000_tenant_unique_constraints hanya ditandai terterapkan lewat
-- `migrate resolve --applied` (k8s/migration-job.yaml). Versi pertama migration ini
-- memakai ON CONFLICT (resource, action, "tenantId") dan gagal di produksi dengan
-- 42P10 tanpa menulis apa pun. NOT EXISTS berlaku di kedua bentuk constraint.
--
-- Aman dijalankan berulang dan aman di lingkungan mana pun:
--   * Role dicocokkan lewat trim(name): di produksi namanya " Branch Manager".
--     Role yang tidak ada = tidak ada yang ditulis (mis. DB lokal hasil seed).
--   * Permission hanya dibuat bila belum ada pasangan (resource, action) di tenant role
--     — di produksi kesepuluhnya sudah dibuat lewat editor Role, jadi tidak ada insert.
--   * Relasi role↔permission memakai ON CONFLICT pada primary key ("A","B"), yang sama
--     di semua lingkungan.
-- Tidak menghapus apa pun; mencabut akses tetap lewat editor Role di admin.

WITH role_sasaran AS (
  SELECT DISTINCT "tenantId"
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
       role_sasaran."tenantId"
FROM izin
CROSS JOIN role_sasaran
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p.resource = izin.resource
    AND p.action = izin.action
    AND p."tenantId" = role_sasaran."tenantId"
);

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
