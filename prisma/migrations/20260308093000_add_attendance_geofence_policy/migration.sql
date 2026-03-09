CREATE TYPE "AttendanceGeofencePolicy" AS ENUM ('STRICT', 'WARN', 'DISABLED');

ALTER TABLE "User"
ADD COLUMN "attendanceGeofencePolicy" "AttendanceGeofencePolicy" NOT NULL DEFAULT 'WARN';
