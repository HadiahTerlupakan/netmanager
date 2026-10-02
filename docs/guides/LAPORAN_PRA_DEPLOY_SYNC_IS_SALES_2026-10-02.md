# Laporan Pra-Deploy — Sinkron `User.isSales` dari Persona Role

**Tanggal:** 2026-10-02
**Migration terkait:**
- `20261001214142_add_persona_to_roles` (menambah `roles.persona` + backfill)
- `20261001222557_sync_user_is_sales_from_role_persona` (data saja: `isSales` = persona role SALES)

Sejak perubahan ini **persona role adalah satu-satunya penentu sales**. Kolom
`User.isSales` tetap ada, tetapi menjadi turunan otomatis (`role.persona = 'SALES'`)
dan tidak lagi bisa diatur dari form user. Migration sinkron akan mengubah
`isSales` pengguna yang nilainya tidak cocok dengan persona role-nya, dan
mematikan `isSales` pengguna tanpa role.

Jalankan salah satu query di bawah **sebelum** `prisma migrate deploy` untuk
meninjau siapa saja yang berubah. Kedua query hanya `SELECT` — aman.

## Cara menjalankan di produksi

```bash
cat laporan.sql | ssh radpro 'sudo -n kubectl exec -i -n netmanager-production db-netmanager-0 -- psql -U netmgr -d netmanager'
```

Cek dulu apakah kolom `roles.persona` sudah ada di produksi:

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'roles' AND column_name = 'persona'
) AS persona_sudah_ada;
```

## A. Persona BELUM ada di produksi (kedua migration dideploy bersamaan)

Query ini mensimulasikan backfill persona SALES dari migration
`add_persona_to_roles` (role non-super-admin yang dipakai user bertanda sales,
atau role kepala sales: memegang `presurvei_rencana` tanpa `view_all`), lalu
menghitung `isSales` baru.

```sql
WITH role_sales AS (
  SELECT r."id",
         r."isSuperAdmin" = false AND (
           EXISTS (SELECT 1 FROM "User" u2 WHERE u2."roleId" = r."id" AND u2."isSales" = true)
           OR (
             EXISTS (SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" p ON p."id" = pr."A"
                     WHERE pr."B" = r."id" AND p."resource" = 'presurvei_rencana')
             AND NOT EXISTS (SELECT 1 FROM "_PermissionToRole" pr JOIN "Permission" p ON p."id" = pr."A"
                     WHERE pr."B" = r."id" AND p."resource" = 'presurvei_rencana' AND p."action" = 'view_all')
           )
         ) AS akan_sales
  FROM "roles" r
)
SELECT u."email",
       t."name"                         AS tenant,
       r."name"                         AS role,
       CASE WHEN rs.akan_sales THEN 'SALES' ELSE '(bukan SALES)' END AS persona_hasil_backfill,
       u."isSales"                      AS is_sales_lama,
       COALESCE(rs.akan_sales, false)   AS is_sales_baru
FROM "User" u
LEFT JOIN "roles" r      ON r."id" = u."roleId"
LEFT JOIN role_sales rs  ON rs."id" = u."roleId"
LEFT JOIN "Tenant" t     ON t."id" = u."tenantId"
WHERE u."isSales" IS DISTINCT FROM COALESCE(rs.akan_sales, false)
ORDER BY t."name", r."name", u."email";
```

## B. Persona SUDAH ada di produksi

```sql
SELECT u."email",
       t."name"                                 AS tenant,
       r."name"                                 AS role,
       COALESCE(r."persona"::text, '(tanpa role)') AS persona,
       u."isSales"                              AS is_sales_lama,
       COALESCE(r."persona" = 'SALES', false)   AS is_sales_baru
FROM "User" u
LEFT JOIN "roles" r  ON r."id" = u."roleId"
LEFT JOIN "Tenant" t ON t."id" = u."tenantId"
WHERE u."isSales" IS DISTINCT FROM COALESCE(r."persona" = 'SALES', false)
ORDER BY t."name", r."name", u."email";
```

## Cara membaca hasil

| Pola | Arti | Tindakan |
|------|------|----------|
| `false → true`, role kepala sales | Kepala sales yang dulu dianggap sales lewat izin role | Benar — tidak perlu tindakan |
| `false → true`, role yang juga dipakai sales lain | Rekan satu role ikut jadi sales karena role-nya kini SALES | Bila keliru: pisahkan role-nya, atau ubah persona role setelah deploy |
| `true → false`, role super admin / tanpa role | Penanda sales lama yang tidak punya dasar persona | Bila orang ini memang sales: beri role ber-persona Sales |

Setelah deploy, koreksi dilakukan lewat **Pengaturan → Hak Akses** (persona role),
bukan lewat form user — `isSales` seluruh pengguna role ikut tersinkron otomatis.

## Hasil di DB lokal (2026-10-02, sebelum migration sinkron diterapkan)

| email | tenant | role | persona | isSales lama → baru |
|-------|--------|------|---------|---------------------|
| admin2@example.com | NETMANAGER | KEPALA SALES | SALES | false → true |

Pengguna tanpa role yang bertanda sales: 0. Setelah migration diterapkan, query B
mengembalikan 0 baris.

## Pembaruan 2026-10-02 sore — simulasi terhadap data produksi

Simulasi read-only (SELECT) terhadap DB produksi sebelum push menemukan:

- Aturan awal `20261001214142_add_persona_to_roles` ("role → SALES bila ada satu user ber-isSales")
  akan menjadikan role **Teknisi (35 user)** dan **Branch Manager (5 user)** SALES, karena 5 teknisi
  dan 2 branch manager ber-isSales warisan. Sync isSales lalu menandai seluruh teknisi sebagai sales.
  **Diperbaiki:** SALES kini hanya role ber-`m_presurvei` (atau `presurvei_rencana` tanpa `view_all`).
  Hasil simulasi ulang: Teknisi, THD, Branch Manager, admin, dll. → TEKNISI; SALES → SALES;
  CEO/CFO/Helpdesk → STAFF.
- Lima user aktif ber-isSales di role non-sales (teknisi yang kadang canvasing: Tatang Cahyana,
  Ali Akbar, Budi Akbar; branch manager: ABBAS BASORI, Muhamad Dede Rakhamattulah) kehilangan
  isSales → tampilan aplikasi mereka menjadi teknisi. Agar tetap bisa **mencairkan bonus
  canvasing**, migration sync kini lebih dulu memberi `m_canvasing:cashout` ke role non-SALES yang
  memegang `m_canvasing` dan punya user aktif ber-isSales. Di produksi: **Teknisi (17 user aktif)**
  dan **Branch Manager (4 user aktif)**. Keputusan pemilik: teknisi tetap teknisi, kadang canvasing.
- `20261002021356` (actualOpex 0 → NULL) tidak mengenai baris apa pun di produksi.
