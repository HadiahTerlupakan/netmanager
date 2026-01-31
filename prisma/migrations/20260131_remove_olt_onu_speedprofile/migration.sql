-- Remove OLT, ONU, OnuType, SpeedProfile tables and related columns
-- This migration cleans up unused OLT/ONU/SpeedProfile features

-- Step 1: Remove foreign key constraints and columns from NetworkAlerts
ALTER TABLE "network_alerts" DROP CONSTRAINT IF EXISTS "network_alerts_oltId_fkey";
ALTER TABLE "network_alerts" DROP CONSTRAINT IF EXISTS "network_alerts_onuId_fkey";
ALTER TABLE "network_alerts" DROP COLUMN IF EXISTS "oltId";
ALTER TABLE "network_alerts" DROP COLUMN IF EXISTS "onuId";

-- Step 2: Remove foreign key constraints and columns from NetworkPerformance
ALTER TABLE "network_performance" DROP CONSTRAINT IF EXISTS "network_performance_oltId_fkey";
ALTER TABLE "network_performance" DROP CONSTRAINT IF EXISTS "network_performance_onuId_fkey";
ALTER TABLE "network_performance" DROP COLUMN IF EXISTS "oltId";
ALTER TABLE "network_performance" DROP COLUMN IF EXISTS "onuId";

-- Step 3: Remove foreign key constraints and columns from ConfigurationRestores
ALTER TABLE "configuration_restores" DROP CONSTRAINT IF EXISTS "configuration_restores_oltId_fkey";
ALTER TABLE "configuration_restores" DROP CONSTRAINT IF EXISTS "configuration_restores_onuId_fkey";
ALTER TABLE "configuration_restores" DROP COLUMN IF EXISTS "oltId";
ALTER TABLE "configuration_restores" DROP COLUMN IF EXISTS "onuId";

-- Step 4: Drop SpeedProfile table (has FK to Olt)
DROP TABLE IF EXISTS "SpeedProfile" CASCADE;

-- Step 5: Drop OnuType table (has FK to Olt)
DROP TABLE IF EXISTS "OnuType" CASCADE;

-- Step 6: Drop Onu table (has FK to Olt)
DROP TABLE IF EXISTS "Onu" CASCADE;

-- Step 7: Drop Olt table
DROP TABLE IF EXISTS "Olt" CASCADE;
