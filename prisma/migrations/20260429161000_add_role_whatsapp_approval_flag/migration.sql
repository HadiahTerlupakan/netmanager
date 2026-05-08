-- Idempotent: only add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles'
    AND column_name = 'canReceiveWhatsappApproval'
  ) THEN
    ALTER TABLE "roles" ADD COLUMN "canReceiveWhatsappApproval" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
