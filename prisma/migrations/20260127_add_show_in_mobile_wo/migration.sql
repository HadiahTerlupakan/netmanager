-- Add showInMobileWO field to departments table
-- This controls which departments appear in mobile app WO request dropdown

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "showInMobileWO" BOOLEAN NOT NULL DEFAULT false;

-- Optionally: copy existing isReminderTarget values to showInMobileWO
UPDATE "departments" SET "showInMobileWO" = "isReminderTarget" WHERE "isReminderTarget" = true;
