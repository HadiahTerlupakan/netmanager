-- WorkOrder Optimization Phase 3: Add composite indexes for performance
-- These indexes optimize common query patterns in the Work Order module

-- Composite indexes for Work Order queries (IF NOT EXISTS ensures idempotency)
CREATE INDEX IF NOT EXISTS "work_orders_status_priority_idx" ON "work_orders"("status", "priority");
CREATE INDEX IF NOT EXISTS "work_orders_status_created_at_idx" ON "work_orders"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "work_orders_status_department_id_idx" ON "work_orders"("status", "departmentId");
CREATE INDEX IF NOT EXISTS "work_orders_type_status_idx" ON "work_orders"("type", "status");
CREATE INDEX IF NOT EXISTS "work_orders_created_at_idx" ON "work_orders"("createdAt");
