-- Add tax fields to suppliers (master vendor)
ALTER TABLE "suppliers"
  ADD COLUMN "npwp" TEXT,
  ADD COLUMN "defaultPphCategory" TEXT;
