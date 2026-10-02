-- Migration data: izin `opname:manage` (atur jadwal stock opname bulanan) untuk role admin.
--
-- Latar: fitur jadwal & kepatuhan SO (migration add_stock_opname_schedule) memakai
-- action baru `manage` pada resource `opname`. Role pengelola diberi izin ini; role
-- lain (mis. Staff Gudang) tetap bisa melihat jadwal lewat `opname:read`.
--
-- Pola sama dengan 20260926100438_grant_presurvei_rencana_permissions_to_admin_roles:
--   * NOT EXISTS per tenant + ON CONFLICT DO NOTHING tanpa target (unique "Permission"
--     berbeda antar-lingkungan).
--   * Role dicocokkan lewat trim(name) dan "tenantId" IS NOT NULL.
-- Aman dijalankan berulang. Tidak menghapus apa pun.

WITH role_sasaran AS (
  SELECT DISTINCT "tenantId"
  FROM roles
  WHERE trim(name) IN ('admin', 'Super Admin', 'Branch Manager', 'KACAB PKP')
    AND "tenantId" IS NOT NULL
)
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT gen_random_uuid()::text,
       'Manage Opname',
       'manage',
       'opname',
       'Izinkan manage pada opname',
       NOW(),
       NOW(),
       role_sasaran."tenantId"
FROM role_sasaran
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p.resource = 'opname'
    AND p.action = 'manage'
    AND p."tenantId" = role_sasaran."tenantId"
)
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p.id, r.id
FROM roles r
JOIN "Permission" p ON p."tenantId" = r."tenantId"
WHERE trim(r.name) IN ('admin', 'Super Admin', 'Branch Manager', 'KACAB PKP')
  AND r."tenantId" IS NOT NULL
  AND p.resource = 'opname'
  AND p.action = 'manage'
ON CONFLICT ("A", "B") DO NOTHING;
