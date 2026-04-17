-- Create unique constraint for partner assignment per work order and tenant
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
