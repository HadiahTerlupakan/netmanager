-- @safe-guard-ack: Change tenantId to NOT NULL on all WorkOrder tables to prevent future data orphan incidents (follow-up to 24 orphan WOs, 12 Apr - 10 Jun 2026). Data already backfilled and verified clean.
-- Set tenantId NOT NULL on all WorkOrder-related tables.
-- Data cleanup (backfill + orphan deletion) was done in the previous migration.

-- Small tables: direct SET NOT NULL is safe
ALTER TABLE "work_orders" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "work_order_assignments" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "work_order_attachments" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "work_order_tasks" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "work_order_materials" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "work_order_material_returns" ALTER COLUMN "tenantId" SET NOT NULL;

-- Large table (work_order_updates ~11k rows): use safe two-step pattern
ALTER TABLE "work_order_updates" ADD CONSTRAINT "chk_updates_tenant_not_null" CHECK ("tenantId" IS NOT NULL) NOT VALID;
ALTER TABLE "work_order_updates" VALIDATE CONSTRAINT "chk_updates_tenant_not_null";
ALTER TABLE "work_order_updates" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "work_order_updates" DROP CONSTRAINT "chk_updates_tenant_not_null";
