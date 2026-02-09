-- AlterTable
ALTER TABLE "departments" ALTER COLUMN "showInMobileWO" SET DEFAULT true;

-- Update existing departments to show in mobile WO
UPDATE "departments" SET "showInMobileWO" = true WHERE "showInMobileWO" = false;
