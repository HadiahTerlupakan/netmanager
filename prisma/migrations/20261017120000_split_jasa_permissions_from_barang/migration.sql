-- Migration data: pisahkan izin Master Jasa dari Master Barang.
--
-- Latar: halaman & API Master Jasa sebelumnya memakai izin `barang:*`, sehingga
-- jasa tidak bisa diatur terpisah dan tidak punya menu sendiri. Kode kini memakai
-- `jasa:read|create|update|delete`.
--
-- Agar tidak ada role yang kehilangan atau mendapat akses baru, setiap role yang
-- memegang `barang:<aksi>` diberi `jasa:<aksi>` yang sama.
--
-- Pola sama dengan 20261002045331_grant_opname_manage_permission_to_admin_roles:
--   * NOT EXISTS per tenant + ON CONFLICT DO NOTHING tanpa target (unique "Permission"
--     berbeda antar-lingkungan; di produksi unique-nya global (resource, action)).
--   * Penautan memilih izin jasa tenant yang sama bila ada, selain itu baris yang ada.
-- Aman dijalankan berulang. Tidak menghapus apa pun.

INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT DISTINCT ON (b.action, b."tenantId")
       gen_random_uuid()::text,
       initcap(b.action) || ' Jasa',
       b.action,
       'jasa',
       'Allow ' || b.action || ' on jasa',
       NOW(),
       NOW(),
       b."tenantId"
FROM "Permission" b
WHERE b.resource = 'barang'
  AND b.action IN ('read', 'create', 'update', 'delete')
  AND NOT EXISTS (
    SELECT 1
    FROM "Permission" j
    WHERE j.resource = 'jasa'
      AND j.action = b.action
      AND j."tenantId" IS NOT DISTINCT FROM b."tenantId"
  )
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT DISTINCT j.id, r.id
FROM "_PermissionToRole" barang_role
JOIN "Permission" b
  ON b.id = barang_role."A"
 AND b.resource = 'barang'
 AND b.action IN ('read', 'create', 'update', 'delete')
JOIN roles r ON r.id = barang_role."B"
JOIN LATERAL (
  SELECT q.id FROM "Permission" q
  WHERE q.resource = 'jasa' AND q.action = b.action
  ORDER BY (q."tenantId" = r."tenantId") DESC NULLS LAST, q."createdAt"
  LIMIT 1
) j ON true
ON CONFLICT ("A", "B") DO NOTHING;
