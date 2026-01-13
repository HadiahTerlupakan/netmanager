-- Create Enum
DO $$ BEGIN
    CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'ABSENT', 'SICK', 'PERMIT', 'DAY_OFF');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update Data (Clean up before cast)
UPDATE "Attendance" SET "status" = 'ABSENT' WHERE "status" = 'MANGKIR';
UPDATE "Attendance" SET "status" = 'ON_TIME' WHERE "status" = 'PRESENT';
UPDATE "Attendance" SET "status" = 'LATE' WHERE "status" = 'TERLAMBAT';

-- Fallback for any unknown values
UPDATE "Attendance" SET "status" = 'ON_TIME' WHERE "status" NOT IN ('ON_TIME', 'LATE', 'ABSENT', 'SICK', 'PERMIT', 'DAY_OFF');

-- Drop Default first to allow type change
ALTER TABLE "Attendance" ALTER COLUMN "status" DROP DEFAULT;

-- Alter Column Type
ALTER TABLE "Attendance" ALTER COLUMN "status" TYPE "AttendanceStatus" USING "status"::"AttendanceStatus";

-- Set New Default
ALTER TABLE "Attendance" ALTER COLUMN "status" SET DEFAULT 'ON_TIME';
