-- Manual migration untuk add performance indexes
-- Tanggal: 2026-05-09
-- Deskripsi: Tambah indexes untuk optimize attendance queries

-- Check existing indexes first
DO $$
BEGIN
    -- Index 1: tenant + checkIn range (untuk admin list dengan date filter)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_attendance_tenant_checkin_range'
    ) THEN
        CREATE INDEX idx_attendance_tenant_checkin_range
        ON "Attendance"("tenantId", "checkIn" DESC);
        RAISE NOTICE 'Created index: idx_attendance_tenant_checkin_range';
    END IF;

    -- Index 2: status + tenant (untuk filter by status)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_attendance_status_tenant'
    ) THEN
        CREATE INDEX idx_attendance_status_tenant
        ON "Attendance"("status", "tenantId");
        RAISE NOTICE 'Created index: idx_attendance_status_tenant';
    END IF;

    -- Index 3: tenant + status + checkIn (composite untuk complex queries)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_attendance_tenant_status_checkin'
    ) THEN
        CREATE INDEX idx_attendance_tenant_status_checkin
        ON "Attendance"("tenantId", "status", "checkIn" DESC);
        RAISE NOTICE 'Created index: idx_attendance_tenant_status_checkin';
    END IF;

    -- Index 4: checkInDate + tenant (untuk daily queries)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_attendance_checkin_date_tenant'
    ) THEN
        CREATE INDEX idx_attendance_checkin_date_tenant
        ON "Attendance"("checkInDate", "tenantId")
        WHERE "checkInDate" IS NOT NULL;
        RAISE NOTICE 'Created index: idx_attendance_checkin_date_tenant';
    END IF;

    -- Index 5: geofenceStatus (untuk geofence analysis)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_attendance_geofence_status'
    ) THEN
        CREATE INDEX idx_attendance_geofence_status
        ON "Attendance"("geofenceStatus", "tenantId")
        WHERE "geofenceStatus" IS NOT NULL;
        RAISE NOTICE 'Created index: idx_attendance_geofence_status';
    END IF;

    -- Index 6: User name + tenant (untuk search optimization)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_user_name_tenant'
    ) THEN
        CREATE INDEX idx_user_name_tenant
        ON "User"("name", "tenantId")
        WHERE "name" IS NOT NULL;
        RAISE NOTICE 'Created index: idx_user_name_tenant';
    END IF;

END $$;

-- Analyze tables untuk update statistics
ANALYZE "Attendance";
ANALYZE "User";
