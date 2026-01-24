-- Database Optimization Phase 1: Add Composite Indexes
-- Date: 2026-01-24
-- Purpose: Optimize common query patterns with composite indexes
-- Risk: LOW - Indexes are additive, no schema changes
-- Note: CONCURRENTLY removed for Prisma migrate compatibility

-- Pelanggan: Queries by site and status (customer list filtering)
CREATE INDEX IF NOT EXISTS "idx_pelanggan_site_status" 
ON "Pelanggan" ("siteId", "status");

-- Invoice: Queries by pelanggan and status (customer invoice history)
CREATE INDEX IF NOT EXISTS "idx_invoice_pelanggan_status" 
ON "Invoice" ("pelangganId", "status");

-- Invoice: Queries by status and dueDate (overdue/upcoming invoices)
CREATE INDEX IF NOT EXISTS "idx_invoice_status_duedate" 
ON "Invoice" ("status", "dueDate");

-- Notifications: Unread count queries (most frequent notification query)
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" 
ON "notifications" ("userId", "isRead");

-- WorkOrders: Queries by assigned user and status (technician workload)
CREATE INDEX IF NOT EXISTS "idx_workorders_assigned_status" 
ON "work_orders" ("assignedToId", "status");

-- WorkOrders: Queries by department and status (department dashboard)
CREATE INDEX IF NOT EXISTS "idx_workorders_department_status" 
ON "work_orders" ("departmentId", "status");

-- User: Queries by department and active status (user management)
CREATE INDEX IF NOT EXISTS "idx_user_department_active" 
ON "User" ("departmentId", "isActive");

-- User: Queries by site and active status (site user lists)
CREATE INDEX IF NOT EXISTS "idx_user_site_active" 
ON "User" ("siteId", "isActive");

