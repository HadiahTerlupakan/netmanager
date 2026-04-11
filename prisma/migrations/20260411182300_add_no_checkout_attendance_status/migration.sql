-- Add NO_CHECKOUT enum value for attendance records created by auto-checkout flows.
-- Guarded with a DO block so repeated runs do not fail on existing databases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'AttendanceStatus'
      AND enum_value.enumlabel = 'NO_CHECKOUT'
  ) THEN
    ALTER TYPE "AttendanceStatus" ADD VALUE 'NO_CHECKOUT';
  END IF;
END $$;
