-- Add tokenVersion column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Fix FK constraint for departmentId (pointing to lowercase "departments" table)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_departmentId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" 
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;
