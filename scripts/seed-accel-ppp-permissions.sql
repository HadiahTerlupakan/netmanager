-- Seed permission accel_ppp untuk environment yang sudah pernah di-seed
-- sebelum modul accel-ppp ditambahkan.
--
-- Cara apply (per tenant) — ganti tenant_id sesuai environment:
--   docker exec <postgres-container> psql -U <user> -d <db> \
--     -v tenant_id="'<TENANT_ID>'" -f scripts/seed-accel-ppp-permissions.sql
--
-- Atau lewat psql langsung:
--   psql $DATABASE_URL -v tenant_id="'<TENANT_ID>'" -f scripts/seed-accel-ppp-permissions.sql
--
-- Yang dilakukan:
--   1. Insert 5 permission untuk resource `accel_ppp`:
--      - accel_ppp:read, accel_ppp:create, accel_ppp:update, accel_ppp:delete
--      - accel_ppp:session:kick (granular untuk operasi kick sensitif)
--   2. Assign semua permission tersebut ke role `isSuperAdmin = true`.
--
-- Idempotent: ON CONFLICT DO NOTHING di kedua step. Aman dijalankan berkali-kali.

\set ON_ERROR_STOP on

DO $$
DECLARE
  perm_id text;
  super_admin_role_id text;
  rec record;
  target_tenant text := current_setting('myapp.tenant_id', true);
BEGIN
  IF target_tenant IS NULL OR target_tenant = '' THEN
    -- Fallback: pakai tenant id pertama. Untuk production sebaiknya
    -- pass eksplisit lewat -v tenant_id=...
    SELECT id INTO target_tenant FROM "Tenant" ORDER BY "createdAt" ASC LIMIT 1;
    RAISE NOTICE 'Using fallback tenant_id: %', target_tenant;
  END IF;

  SELECT id INTO super_admin_role_id
  FROM roles
  WHERE "isSuperAdmin" = true AND ("tenantId" = target_tenant OR "tenantId" IS NULL)
  LIMIT 1;

  IF super_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'No super admin role found for tenant %', target_tenant;
  END IF;

  RAISE NOTICE 'Tenant: %, super admin role: %', target_tenant, super_admin_role_id;

  -- Standard CRUD actions
  FOR rec IN SELECT unnest(ARRAY['read','create','update','delete']) AS action
  LOOP
    perm_id := gen_random_uuid()::text;
    INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
    VALUES (
      perm_id,
      INITCAP(rec.action) || ' Accel_ppp',
      rec.action,
      'accel_ppp',
      'Allow ' || rec.action || ' on accel_ppp',
      NOW(),
      NOW(),
      target_tenant
    )
    ON CONFLICT (resource, action, "tenantId") DO NOTHING
    RETURNING id INTO perm_id;

    IF perm_id IS NOT NULL THEN
      INSERT INTO "_PermissionToRole" ("A", "B")
      VALUES (perm_id, super_admin_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Granular: kick session
  perm_id := gen_random_uuid()::text;
  INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
  VALUES (
    perm_id,
    'Kick Accel-PPP session',
    'session:kick',
    'accel_ppp',
    'Putuskan sesi PPPoE aktif di accel-ppp',
    NOW(),
    NOW(),
    target_tenant
  )
  ON CONFLICT (resource, action, "tenantId") DO NOTHING
  RETURNING id INTO perm_id;

  IF perm_id IS NOT NULL THEN
    INSERT INTO "_PermissionToRole" ("A", "B")
    VALUES (perm_id, super_admin_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

SELECT resource, action FROM "Permission" WHERE resource = 'accel_ppp' ORDER BY action;
