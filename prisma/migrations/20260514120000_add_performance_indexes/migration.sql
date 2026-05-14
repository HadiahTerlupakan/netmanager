-- Performance indexes untuk mobile API endpoints yang lambat (3+ detik)
-- Ref: review session 2026-05-14

-- WorkOrders: optimasi query GET /api/mobile/work-orders/available
-- Filter: tenantId + status + assignedToId IS NULL + assignedMitraId IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_wo_available_lookup"
ON "work_orders" ("tenantId", "status", "assignedToId", "assignedMitraId");

-- LeaveRequest: optimasi query GET /api/mobile/leaves
-- Filter: userId + tenantId, ORDER BY createdAt DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_leave_user_tenant_date"
ON "LeaveRequest" ("userId", "tenantId", "createdAt" DESC);

-- AttendanceEvaluation: optimasi query findLatestEvaluationForUser
-- Filter: userId, ORDER BY evaluatedAt DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_eval_user_date"
ON "AttendanceEvaluation" ("userId", "evaluatedAt" DESC);
