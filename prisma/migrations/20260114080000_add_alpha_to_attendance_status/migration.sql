-- Add ALPHA value to AttendanceStatus enum (idempotent)
-- This migration safely adds the ALPHA status for employees who are absent without permission

DO $$
BEGIN
    -- Check if ALPHA value already exists in enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'ALPHA' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AttendanceStatus')
    ) THEN
        ALTER TYPE "AttendanceStatus" ADD VALUE 'ALPHA';
    END IF;
END $$;
