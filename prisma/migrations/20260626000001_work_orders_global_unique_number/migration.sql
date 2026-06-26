-- Step 1: Cleanup orphan duplicate WOs (tenantId IS NULL, duplicate workOrderNumber)
-- These are artifacts from the race condition incident on 12 April 2026.
-- Orphan WOs (no tenant) are deleted; legitimate WOs (with tenantId) are preserved.
DELETE FROM work_order_tasks
WHERE "workOrderId" IN (
  SELECT id FROM work_orders
  WHERE "workOrderNumber" IN (
    SELECT "workOrderNumber" FROM work_orders WHERE "tenantId" IS NOT NULL
    INTERSECT
    SELECT "workOrderNumber" FROM work_orders WHERE "tenantId" IS NULL
  ) AND "tenantId" IS NULL
);

DELETE FROM work_orders
WHERE "workOrderNumber" IN (
  SELECT "workOrderNumber" FROM work_orders WHERE "tenantId" IS NOT NULL
  INTERSECT
  SELECT "workOrderNumber" FROM work_orders WHERE "tenantId" IS NULL
) AND "tenantId" IS NULL;

-- Step 2: Cleanup duplicate assignments (keep earliest per workOrderId+userId+role)
DELETE FROM work_order_assignments
WHERE id NOT IN (
  SELECT MIN(id) FROM work_order_assignments GROUP BY "workOrderId", "userId", role
);

-- Step 3: Backfill tenantId in child tables from parent work_orders
UPDATE work_order_assignments a SET "tenantId" = wo."tenantId"
FROM work_orders wo WHERE a."workOrderId" = wo.id AND a."tenantId" IS NULL AND wo."tenantId" IS NOT NULL;

UPDATE work_order_attachments a SET "tenantId" = wo."tenantId"
FROM work_orders wo WHERE a."workOrderId" = wo.id AND a."tenantId" IS NULL AND wo."tenantId" IS NOT NULL;

UPDATE work_order_tasks t SET "tenantId" = wo."tenantId"
FROM work_orders wo WHERE t."workOrderId" = wo.id AND t."tenantId" IS NULL AND wo."tenantId" IS NOT NULL;

UPDATE work_order_updates u SET "tenantId" = wo."tenantId"
FROM work_orders wo WHERE u."workOrderId" = wo.id AND u."tenantId" IS NULL AND wo."tenantId" IS NOT NULL;

-- Step 4: Create global unique index on workOrderNumber
CREATE UNIQUE INDEX "uniq_workOrderNumber_global" ON "work_orders"("workOrderNumber");
