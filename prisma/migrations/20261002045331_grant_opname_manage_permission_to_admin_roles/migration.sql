-- Migration data: izin `opname:manage` (pengelola stock opname) untuk role admin.
--
-- Latar: fitur jadwal SO per site (migration add_stock_opname_schedule_per_site)
-- mengirim ringkasan gudang yang tidak tuntas SO ke pemegang action baru `manage`
-- pada resource `opname`. Jadwal sendiri diatur lewat izin `site:update`.
--
-- Pola sama dengan 20260926100438_grant_presurvei_rencana_permissions_to_admin_roles:
--   * NOT EXISTS per tenant + ON CONFLICT DO NOTHING tanpa target (unique "Permission"
--     berbeda antar-lingkungan).
--   * Role dicocokkan lewat trim(name) dan "tenantId" IS NOT NULL.
--   * Penautan role↔izin memilih izin tenant yang sama bila ada, selain itu baris
--     (resource, action) yang sudah ada — di produksi unique-nya global sehingga tenant
--     kedua tidak punya baris sendiri (INSERT di atas dilewati ON CONFLICT).
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
JOIN LATERAL (
  SELECT q.id FROM "Permission" q
  WHERE q.resource = 'opname' AND q.action = 'manage'
  ORDER BY (q."tenantId" = r."tenantId") DESC NULLS LAST, q."createdAt"
  LIMIT 1
) p ON true
WHERE trim(r.name) IN ('admin', 'Super Admin', 'Branch Manager', 'KACAB PKP')
  AND r."tenantId" IS NOT NULL
ON CONFLICT ("A", "B") DO NOTHING;
