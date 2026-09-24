-- Migration data: beri izin presurvei mobile ke role SALES.
--
-- Latar: sales karyawan mendapat tab Presurvei di aplikasi mobile (mobile-netmanager,
-- spec 2026-09-24-tampilan-sales-karyawan-presurvei). Route presurvei menerima
-- m_presurvei:{read,create,update} (app/api/presurvei/**); role SALES produksi belum
-- memegangnya. Permission web presurvei:* sengaja TIDAK diberikan: pemegangnya melihat
-- data seluruh tenant (app/api/presurvei/akses-presurvei.ts).
--
-- Pola 20260923211611_grant_presurvei_permissions_to_admin_roles, dengan satu tambahan:
-- unique "Permission" produksi adalah (resource, action) GLOBAL
-- (Permission_resource_action_key, 20260313000000_init_squashed:2670), sedangkan lokal
-- (resource, action, "tenantId"). NOT EXISTS per tenant saja masih bisa melanggar unique
-- global bila tenant lain sudah punya pasangan itu, jadi insert juga diberi
-- ON CONFLICT DO NOTHING TANPA target — berlaku untuk constraint mana pun (ON CONFLICT
-- dengan target kolom gagal 42P10 bila constraint-nya berbeda, lihat migration preseden).
--
-- Keterbatasan multi-tenant di bawah unique global (produksi): bila tenant lain sudah
-- memiliki baris m_presurvei:<action>, insert untuk tenant role SALES dilewati tanpa
-- galat, dan relasi hanya dibuat ke Permission ber-tenant sama dengan role — tenant itu
-- TIDAK mendapat izin tersebut. Per 2026-09-25 produksi hanya punya satu role SALES
-- (satu tenant) dan belum ada baris m_presurvei sama sekali, jadi ketiga izin tercipta.
--
-- Aman dijalankan berulang dan di lingkungan mana pun:
--   * Role dicocokkan lewat trim(name) = 'SALES' dan "tenantId" IS NOT NULL.
--     Tidak ada role itu = tidak ada yang ditulis.
--   * Permission dibuat hanya bila belum ada di tenant role; bentrok unique dilewati.
--   * Relasi role↔permission memakai ON CONFLICT pada primary key ("A","B").
-- Tidak menghapus apa pun; mencabut akses tetap lewat editor Role di admin.

WITH role_sales AS (
  SELECT DISTINCT "tenantId"
  FROM roles
  WHERE trim(name) = 'SALES'
    AND "tenantId" IS NOT NULL
),
izin(resource, action, name) AS (
  VALUES
    ('m_presurvei', 'read',   'Read M_presurvei'),
    ('m_presurvei', 'create', 'Create M_presurvei'),
    ('m_presurvei', 'update', 'Update M_presurvei')
)
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT gen_random_uuid()::text,
       izin.name,
       izin.action,
       izin.resource,
       'Allow ' || izin.action || ' on ' || izin.resource,
       NOW(),
       NOW(),
       role_sales."tenantId"
FROM izin
CROSS JOIN role_sales
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p.resource = izin.resource
    AND p.action = izin.action
    AND p."tenantId" = role_sales."tenantId"
)
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p.id, r.id
FROM roles r
JOIN "Permission" p ON p."tenantId" = r."tenantId"
WHERE trim(r.name) = 'SALES'
  AND r."tenantId" IS NOT NULL
  AND p.resource = 'm_presurvei'
  AND p.action IN ('read', 'create', 'update')
ON CONFLICT ("A", "B") DO NOTHING;
