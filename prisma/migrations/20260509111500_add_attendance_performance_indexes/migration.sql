-- Add performance indexes for attendance queries
-- Migration: 20260509111500_add_attendance_performance_indexes

-- Index untuk admin list query dengan filter tenant + date range
-- Query pattern: WHERE tenantId = ? AND checkIn BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS "idx_attendance_tenant_checkin_range" ON "Attendance"("tenantId", "checkIn" DESC);

-- Index untuk filter by status + tenant
-- Query pattern: WHERE tenantId = ? AND status = ?
CREATE INDEX IF NOT EXISTS "idx_attendance_status_tenant" ON "Attendance"("status", "tenantId");

-- Index untuk filter by tenant + status + date range (composite)
-- Query pattern: WHERE tenantId = ? AND status = ? AND checkIn BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS "idx_attendance_tenant_status_checkin" ON "Attendance"("tenantId", "status", "checkIn" DESC);

-- Index untuk search by user dengan tenant isolation
-- Query pattern: JOIN users WHERE users.name LIKE ? AND attendance.tenantId = ?
-- Note: Index di User table untuk optimize JOIN
CREATE INDEX IF NOT EXISTS "idx_user_name_tenant" ON "User"("name", "tenantId") WHERE "name" IS NOT NULL;

-- Index untuk filter by checkInDate (used in unique constraint)
-- Query pattern: WHERE checkInDate = ? AND tenantId = ?
CREATE INDEX IF NOT EXISTS "idx_attendance_checkin_date_tenant" ON "Attendance"("checkInDate", "tenantId") WHERE "checkInDate" IS NOT NULL;

-- Index untuk correction queries
-- Query pattern: WHERE correctedAt IS NOT NULL AND tenantId = ?
-- Already exists: @@index([tenantId, correctedAt])

-- Index untuk geofence analysis queries
-- Query pattern: WHERE geofenceStatus = ? AND tenantId = ?
CREATE INDEX IF NOT EXISTS "idx_attendance_geofence_status" ON "Attendance"("geofenceStatus", "tenantId") WHERE "geofenceStatus" IS NOT NULL;
