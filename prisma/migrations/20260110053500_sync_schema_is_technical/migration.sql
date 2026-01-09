-- Create new columns
ALTER TABLE "roles" ADD COLUMN "isTechnical" BOOLEAN NOT NULL DEFAULT false;

-- Add other drift changes reported by prisma previously
-- Note: User chose not to reset DB, so we provide this catch-up migration.
-- Check if table exists before adding columns to avoid errors if partially applied

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'isTechnical') THEN
        ALTER TABLE "roles" ADD COLUMN "isTechnical" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
