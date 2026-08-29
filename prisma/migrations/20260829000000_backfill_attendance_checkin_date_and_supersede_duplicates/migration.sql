-- Aktifkan kembali proteksi duplikat harian pada tabel Attendance.
--
-- Latar belakang: sejak migration 20260331070000 kolom "checkInDate" menjadi bagian
-- dari unique index idx_attendance_user_checkin_date_tenant. Semua jalur pembuatan
-- attendance buatan sistem (auto ABSENT, DAY_OFF, sinkronisasi cuti, backdate admin)
-- meninggalkan kolom itu NULL. Postgres memperlakukan NULL sebagai nilai yang selalu
-- distinct, sehingga baris-baris tersebut tidak pernah tertahan unique index dan
-- kehadiran yang tersinkron belakangan (offline sync) menghasilkan baris kedua
-- di hari yang sama.
--
-- Migration ini: (1) melepas baris yang kalah pada hari yang punya lebih dari satu
-- baris aktif, lalu (2) mengisi "checkInDate" untuk seluruh baris aktif yang tersisa
-- sehingga unique index kembali berfungsi.

-- Langkah 1: pada setiap (user, tenant, hari) sisakan satu baris aktif.
-- Prioritas: kehadiran nyata mengalahkan placeholder sistem; bila setara, baris
-- yang lebih dulu dibuat yang dipertahankan. Baris yang kalah tidak dihapus —
-- hanya ditandai sudah digantikan dan dilepas dari slot hariannya, supaya jejak
-- audit tetap utuh.
WITH "RankedDay" AS (
  SELECT
    a.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        a."userId",
        a."tenantId",
        (a."checkIn" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date
      ORDER BY
        CASE WHEN a.status IN ('ABSENT', 'ALPHA', 'DAY_OFF') THEN 1 ELSE 0 END,
        a."createdAt"
    ) AS rank_in_day
  FROM "Attendance" a
  WHERE a."correctedAt" IS NULL
)
UPDATE "Attendance" a
SET "correctedAt" = NOW(),
    "checkInDate" = NULL,
    "correctionSource" = 'LATE_ATTENDANCE_REPLACEMENT',
    "correctionReason" = 'Digantikan baris kehadiran lain pada hari yang sama'
FROM "RankedDay" r
WHERE a.id = r.id
  AND r.rank_in_day > 1;

-- Langkah 2: isi checkInDate untuk baris aktif yang masih NULL, memakai definisi
-- yang sama dengan aplikasi (awal hari pada timezone tenant, disimpan sebagai UTC).
--
-- Kolom bertipe "timestamp without time zone" berisi waktu UTC, jadi konversinya
-- harus dua langkah: tandai nilainya sebagai UTC, ubah ke waktu lokal Jakarta,
-- potong ke awal hari, lalu kembalikan ke UTC. Ekspresi satu langkah
-- ("checkIn" AT TIME ZONE 'Asia/Jakarta') menggeser ke arah yang berlawanan.
UPDATE "Attendance"
SET "checkInDate" = (
      DATE_TRUNC('day', "checkIn" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')
      AT TIME ZONE 'Asia/Jakarta'
    ) AT TIME ZONE 'UTC'
WHERE "checkInDate" IS NULL
  AND "correctedAt" IS NULL;
