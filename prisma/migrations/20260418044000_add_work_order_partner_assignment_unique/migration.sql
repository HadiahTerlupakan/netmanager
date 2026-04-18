-- @safe-guard-ack: Deduplicate legacy work order assignments before enforcing tenant-scoped uniqueness for user-based assignments.
WITH ranked_assignments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "workOrderId", "userId", role, "tenantId"
      ORDER BY
        CASE WHEN "respondedAt" IS NULL THEN 1 ELSE 0 END,
        COALESCE("respondedAt", "assignedAt") DESC,
        "assignedAt" DESC,
        id DESC
    ) AS row_num
  FROM "work_order_assignments"
  WHERE "userId" IS NOT NULL
    AND role IS NOT NULL
    AND "tenantId" IS NOT NULL
)
DELETE FROM "work_order_assignments"
WHERE id IN (
  SELECT id
  FROM ranked_assignments
  WHERE row_num > 1
);

DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1
  FROM pg_class
  WHERE relname = 'uniq_work_order_partner_assignment'
) THEN
  CREATE UNIQUE INDEX "uniq_work_order_partner_assignment"
  ON "work_order_assignments"("workOrderId", "userId", "role", "tenantId");
END IF;
END $$;
