-- Attendance System Phase 2: Add composite indexes for performance
-- These indexes optimize common query patterns in Attendance module
-- Expected impact: 50-70% faster attendance queries, reduced database load

-- Composite index for user check-in queries (userId + checkIn DESC)
-- Optimizes queries like: find today's attendance by user
CREATE INDEX IF NOT EXISTS "idx_attendance_user_checkin" 
ON "Attendance"("userId", "checkIn" DESC);

-- Composite index for user check-out queries (userId + checkOut DESC)
-- Optimizes queries like: find recent check-outs by user
CREATE INDEX IF NOT EXISTS "idx_attendance_user_checkout" 
ON "Attendance"("userId", "checkOut" DESC);

-- Composite index for overtime queries (userId + status)
-- Optimizes queries like: find pending overtime requests by user
CREATE INDEX IF NOT EXISTS "idx_overtime_user_status" 
ON "Overtime"("userId", "status");

-- Composite index for leave date range queries (startDate + endDate)
-- Optimizes queries like: find leaves within a date range
CREATE INDEX IF NOT EXISTS "idx_leave_dates" 
ON "LeaveRequest"("startDate", "endDate");
