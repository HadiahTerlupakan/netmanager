-- Safe Migration for Geofence and Location
-- Handles adding columns/tables only if they don't exist

-- 1. Create employee_locations table if not exists
CREATE TABLE IF NOT EXISTS "employee_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "batteryLevel" DOUBLE PRECISION,
    "isMoving" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_locations_pkey" PRIMARY KEY ("id")
);

-- 2. Add Geofence columns to Attendance if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Attendance' AND column_name='geofenceStatus') THEN
        ALTER TABLE "Attendance" ADD COLUMN "geofenceStatus" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Attendance' AND column_name='geofenceDistance') THEN
        ALTER TABLE "Attendance" ADD COLUMN "geofenceDistance" DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Attendance' AND column_name='geofenceSiteName') THEN
        ALTER TABLE "Attendance" ADD COLUMN "geofenceSiteName" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Attendance' AND column_name='checkOutGeofenceStatus') THEN
        ALTER TABLE "Attendance" ADD COLUMN "checkOutGeofenceStatus" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Attendance' AND column_name='checkOutGeofenceDistance') THEN
        ALTER TABLE "Attendance" ADD COLUMN "checkOutGeofenceDistance" DOUBLE PRECISION;
    END IF;
END $$;
