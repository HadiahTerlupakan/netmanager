-- Migration: Change unique constraints to be per-tenant (compound unique with tenantId)

-- 1. Drop old global unique constraint on Role.name
DROP INDEX IF EXISTS "roles_name_key";

-- 2. Create new compound unique constraint on Role(name, tenantId)
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_name_tenantId_key') THEN
  CREATE UNIQUE INDEX "roles_name_tenantId_key" ON "roles"("name", "tenantId");
END IF;
END $$;

-- 3. Drop old global unique constraint on Permission(resource, action)
DROP INDEX IF EXISTS "Permission_resource_action_key";

-- 4. Create new compound unique constraint on Permission(resource, action, tenantId)
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Permission_resource_action_tenantId_key') THEN
  CREATE UNIQUE INDEX "Permission_resource_action_tenantId_key" ON "Permission"("resource", "action", "tenantId");
END IF;
END $$;

-- 5. Drop old global unique constraint on Settings.key
DROP INDEX IF EXISTS "Settings_key_key";

-- 6. Create new compound unique constraint on Settings(key, tenantId)
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Settings_key_tenantId_key') THEN
  CREATE UNIQUE INDEX "Settings_key_tenantId_key" ON "Settings"("key", "tenantId");
END IF;
END $$;
