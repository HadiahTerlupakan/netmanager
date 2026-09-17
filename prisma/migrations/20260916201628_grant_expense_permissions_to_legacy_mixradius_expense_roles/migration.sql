-- Resource permission `mixradius_expenses` pensiun bersama integrasi MixRadius.
-- Selama ini setiap pengecekan (halaman, sidebar, dan API RAB/pengeluaran) menerima
-- `mixradius_expenses:<aksi>` ATAU `expense:<aksi>`, sehingga keduanya setara.
-- Kode kini hanya memeriksa `expense:<aksi>`. Role yang hanya memegang resource lama
-- diberi padanan `expense:<aksi>` agar aksesnya ke RAB dan pengeluaran tidak hilang.
--
-- `site_only` sengaja tidak ikut: `mixradius_expenses:site_only` tidak pernah
-- ditegakkan, sedangkan `expense:site_only` membatasi data per site — memberikannya
-- justru akan mempersempit akses role tersebut.
--
-- Non-destruktif: tidak ada row yang dihapus, dan aman bila dijalankan ulang.

-- 1. Pastikan row `expense:<aksi>` tersedia untuk setiap tenant yang memakai resource lama.
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT DISTINCT ON (legacy.action, legacy."tenantId")
  gen_random_uuid()::text,
  initcap(legacy.action) || ' Expense',
  legacy.action,
  'expense',
  'Allow ' || legacy.action || ' on expense',
  NOW(),
  NOW(),
  legacy."tenantId"
FROM "Permission" legacy
JOIN "_PermissionToRole" link ON link."A" = legacy.id
WHERE legacy.resource = 'mixradius_expenses'
  AND legacy.action IN ('read', 'create', 'update', 'delete')
  AND NOT EXISTS (
    SELECT 1
    FROM "Permission" existing
    WHERE existing.resource = 'expense'
      AND existing.action = legacy.action
      AND existing."tenantId" IS NOT DISTINCT FROM legacy."tenantId"
  );

-- 2. Tautkan role pemegang `mixradius_expenses:<aksi>` ke `expense:<aksi>`,
--    kecuali role itu sudah memegang `expense:<aksi>`.
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT DISTINCT ON (link."B", legacy.action)
  expense.id,
  link."B"
FROM "_PermissionToRole" link
JOIN "Permission" legacy ON legacy.id = link."A"
JOIN "Permission" expense
  ON expense.resource = 'expense'
  AND expense.action = legacy.action
  AND expense."tenantId" IS NOT DISTINCT FROM legacy."tenantId"
WHERE legacy.resource = 'mixradius_expenses'
  AND legacy.action IN ('read', 'create', 'update', 'delete')
  AND NOT EXISTS (
    SELECT 1
    FROM "_PermissionToRole" held
    JOIN "Permission" held_permission ON held_permission.id = held."A"
    WHERE held."B" = link."B"
      AND held_permission.resource = 'expense'
      AND held_permission.action = legacy.action
  )
ORDER BY link."B", legacy.action, expense."createdAt", expense.id
ON CONFLICT DO NOTHING;
