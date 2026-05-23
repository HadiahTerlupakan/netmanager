-- ============================================
-- Pre-flight audit untuk migration:
--   20260522166000_olt_module_enums_and_schema_evolve
-- ============================================
-- Jalankan ini di production (read-only) SEBELUM apply migration di atas.
-- Kalau ada output non-empty di section "Bad values", tambahkan UPDATE mapping
-- di awal migration tersebut (atau di file migration baru sebelumnya) untuk
-- normalize nilai existing ke value enum yang valid.
--
-- Cara pakai:
--   psql "$DATABASE_URL" -f scripts/db-audit/pre-olt-enum-migration.sql
-- ============================================

\echo '=== Audit nilai existing kolom OLT/ONU ==='
\echo ''

-- olt_devices.vendor
\echo '[olt_devices.vendor] Distribusi nilai sekarang:'
SELECT vendor, COUNT(*) AS rows
FROM olt_devices
GROUP BY vendor
ORDER BY rows DESC;

\echo '[olt_devices.vendor] Bad values (di luar OltVendor enum):'
SELECT DISTINCT vendor
FROM olt_devices
WHERE vendor IS NOT NULL
  AND vendor NOT IN ('ZTE', 'HSGQ', 'HIOSO', 'CDATA');

-- olt_devices.status
\echo ''
\echo '[olt_devices.status] Distribusi nilai sekarang:'
SELECT status, COUNT(*) AS rows
FROM olt_devices
GROUP BY status
ORDER BY rows DESC;

\echo '[olt_devices.status] Bad values (di luar OltStatus enum):'
SELECT DISTINCT status
FROM olt_devices
WHERE status IS NOT NULL
  AND status NOT IN ('ACTIVE', 'MAINTENANCE', 'OFFLINE');

-- onu_devices.status
\echo ''
\echo '[onu_devices.status] Distribusi nilai sekarang:'
SELECT status, COUNT(*) AS rows
FROM onu_devices
GROUP BY status
ORDER BY rows DESC;

\echo '[onu_devices.status] Bad values (di luar OnuStatus enum):'
SELECT DISTINCT status
FROM onu_devices
WHERE status IS NOT NULL
  AND status NOT IN ('UNREGISTERED', 'REGISTERED', 'ACTIVE', 'OFFLINE', 'DISABLED', 'LOS');

-- onu_pre_registrations.status
\echo ''
\echo '[onu_pre_registrations.status] Distribusi nilai sekarang:'
SELECT status, COUNT(*) AS rows
FROM onu_pre_registrations
GROUP BY status
ORDER BY rows DESC;

\echo '[onu_pre_registrations.status] Bad values (di luar PreRegStatus enum):'
SELECT DISTINCT status
FROM onu_pre_registrations
WHERE status IS NOT NULL
  AND status NOT IN ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- olt_command_logs.result
\echo ''
\echo '[olt_command_logs.result] Distribusi nilai sekarang:'
SELECT result, COUNT(*) AS rows
FROM olt_command_logs
GROUP BY result
ORDER BY rows DESC;

\echo '[olt_command_logs.result] Bad values (di luar OltCommandResult enum):'
SELECT DISTINCT result
FROM olt_command_logs
WHERE result IS NOT NULL
  AND result NOT IN ('SUCCESS', 'FAILED', 'TIMEOUT', 'PENDING');

-- olt_command_logs.params NULL count
\echo ''
\echo '[olt_command_logs.params] Jumlah row dengan NULL (akan di-backfill ke ''{}'' saat migrasi):'
SELECT COUNT(*) AS null_rows
FROM olt_command_logs
WHERE params IS NULL;

-- olt_devices.snmpPort NULL count
\echo ''
\echo '[olt_devices.snmpPort] Jumlah row dengan NULL (akan di-backfill ke 161):'
SELECT COUNT(*) AS null_rows
FROM olt_devices
WHERE "snmpPort" IS NULL;

\echo ''
\echo '=== Audit selesai ==='
\echo ''
\echo 'Jika semua "Bad values" section kosong, migration aman dijalankan.'
\echo 'Jika ada bad values, buat UPDATE mapping di file migration sebelum ALTER TYPE.'
