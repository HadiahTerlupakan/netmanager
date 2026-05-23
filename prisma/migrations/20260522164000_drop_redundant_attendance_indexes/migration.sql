-- Drop redundant Attendance indexes (idempotent)
-- Originally added by 20260509111500_add_attendance_performance_indexes
-- but obsolete since query patterns shifted to userId-based access.

DROP INDEX IF EXISTS "idx_attendance_status_tenant";
DROP INDEX IF EXISTS "idx_attendance_tenant_checkin_range";
DROP INDEX IF EXISTS "idx_attendance_tenant_status_checkin";

