-- Revert: Set showInMobileWO back to false so admin can manually enable
-- Only departments checked by admin should appear in mobile app dropdown

-- Change default back to false for new departments
ALTER TABLE "departments" ALTER COLUMN "showInMobileWO" SET DEFAULT false;

-- Reset all departments to false - admin will enable manually via UI
UPDATE "departments" SET "showInMobileWO" = false;
