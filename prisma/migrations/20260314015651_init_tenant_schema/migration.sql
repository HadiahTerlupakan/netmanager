-- @safe-guard-ack: Adding Tenant model and tenantId for Multi-Tenant SaaS architecture
-- AlterTable
ALTER TABLE "ARAgingSnapshot" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AnnouncementRead" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "employee_locations" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Bandwidth" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CouponUsage" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CustomerCohort" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "HargaPaket" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvestorPayout" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RabInvestor" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Joinbox" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "JoinboxInput" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "JoinboxOutput" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "KmzFile" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveBalance" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MRRMovement" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MikroTikRouter" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Odc" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OdcOutput" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Odp" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OdpOutput" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Otb" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OtbCore" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Overtime" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Pole" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ProfilePPP" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ReminderLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RevenueSnapshot" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SystemLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "user_sites" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang_gudang" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang_keluar" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang_masuk" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "configuration_restores" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "customer_usage" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "device_backups" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "gudang" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "network_alerts" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "network_performance" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "restock_alerts" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "restock_settings" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "service_suspension" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "sla" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "stock_opname" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ticket_replies" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "transfer_antar_gudang" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "usage_analytics" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_assignments" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_attachments" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_escalations" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_tasks" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_templates" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_material_returns" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "app_versions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "canvasing" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "point_claims" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "asset_depreciation_logs" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salaries" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salary_components" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salary_details" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salary_revisions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "user_salary_components" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_materials" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_template_items" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mapping_nodes" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mapping_edges" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "map_settings" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_projects" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_revisions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_revision_approvals" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_revision_items" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_approvals" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_items" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_wbs" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_disbursements" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "acs_vendors" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "acs_wifi_security" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "company_bank_accounts" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_actual_achievements" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "employee_loans" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "loan_payments" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ARAgingSnapshot_tenantId_idx" ON "ARAgingSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Announcement_tenantId_idx" ON "Announcement"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnnouncementRead_tenantId_idx" ON "AnnouncementRead"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_tenantId_idx" ON "Attendance"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_locations_tenantId_idx" ON "employee_locations"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bandwidth_tenantId_idx" ON "Bandwidth"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Coupon_tenantId_idx" ON "Coupon"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CouponUsage_tenantId_idx" ON "CouponUsage"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCohort_tenantId_idx" ON "CustomerCohort"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_idx" ON "ExpenseCategory"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_tenantId_idx" ON "Expense"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HargaPaket_tenantId_idx" ON "HargaPaket"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Investor_tenantId_idx" ON "Investor"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvestorPayout_tenantId_idx" ON "InvestorPayout"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RabInvestor_tenantId_idx" ON "RabInvestor"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Holiday_tenantId_idx" ON "Holiday"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Joinbox_tenantId_idx" ON "Joinbox"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JoinboxInput_tenantId_idx" ON "JoinboxInput"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JoinboxOutput_tenantId_idx" ON "JoinboxOutput"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KmzFile_tenantId_idx" ON "KmzFile"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_tenantId_idx" ON "LeaveRequest"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveBalance_tenantId_idx" ON "LeaveBalance"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MRRMovement_tenantId_idx" ON "MRRMovement"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MikroTikRouter_tenantId_idx" ON "MikroTikRouter"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Odc_tenantId_idx" ON "Odc"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OdcOutput_tenantId_idx" ON "OdcOutput"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Odp_tenantId_idx" ON "Odp"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OdpOutput_tenantId_idx" ON "OdpOutput"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Otb_tenantId_idx" ON "Otb"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtbCore_tenantId_idx" ON "OtbCore"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Overtime_tenantId_idx" ON "Overtime"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Pelanggan_tenantId_idx" ON "Pelanggan"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Permission_tenantId_idx" ON "Permission"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Pole_tenantId_idx" ON "Pole"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProfilePPP_tenantId_idx" ON "ProfilePPP"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReminderLog_tenantId_idx" ON "ReminderLog"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevenueSnapshot_tenantId_idx" ON "RevenueSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Settings_tenantId_idx" ON "Settings"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SystemLog_tenantId_idx" ON "SystemLog"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_sites_tenantId_idx" ON "user_sites"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barang_tenantId_idx" ON "barang"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barang_gudang_tenantId_idx" ON "barang_gudang"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barang_keluar_tenantId_idx" ON "barang_keluar"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "barang_masuk_tenantId_idx" ON "barang_masuk"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "configuration_restores_tenantId_idx" ON "configuration_restores"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customer_usage_tenantId_idx" ON "customer_usage"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "device_backups_tenantId_idx" ON "device_backups"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "gudang_tenantId_idx" ON "gudang"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "network_alerts_tenantId_idx" ON "network_alerts"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "network_performance_tenantId_idx" ON "network_performance"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "positions_tenantId_idx" ON "positions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "push_subscriptions_tenantId_idx" ON "push_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registrations_tenantId_idx" ON "registrations"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "restock_alerts_tenantId_idx" ON "restock_alerts"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "restock_settings_tenantId_idx" ON "restock_settings"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_suspension_tenantId_idx" ON "service_suspension"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sites_tenantId_idx" ON "sites"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sla_tenantId_idx" ON "sla"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_opname_tenantId_idx" ON "stock_opname"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_tenantId_idx" ON "support_tickets"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_replies_tenantId_idx" ON "ticket_replies"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transfer_antar_gudang_tenantId_idx" ON "transfer_antar_gudang"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_analytics_tenantId_idx" ON "usage_analytics"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_assignments_tenantId_idx" ON "work_order_assignments"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_attachments_tenantId_idx" ON "work_order_attachments"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_escalations_tenantId_idx" ON "work_order_escalations"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_tasks_tenantId_idx" ON "work_order_tasks"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_templates_tenantId_idx" ON "work_order_templates"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_updates_tenantId_idx" ON "work_order_updates"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_orders_tenantId_idx" ON "work_orders"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_material_returns_tenantId_idx" ON "work_order_material_returns"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conversation_tenantId_idx" ON "Conversation"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConversationParticipant_tenantId_idx" ON "ConversationParticipant"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_tenantId_idx" ON "Message"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_versions_tenantId_idx" ON "app_versions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shift_tenantId_idx" ON "Shift"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "canvasing_tenantId_idx" ON "canvasing"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "point_claims_tenantId_idx" ON "point_claims"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_requests_tenantId_idx" ON "purchase_requests"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_request_items_tenantId_idx" ON "purchase_request_items"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_tenantId_idx" ON "purchase_orders"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_order_items_tenantId_idx" ON "purchase_order_items"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "financial_accounts_tenantId_idx" ON "financial_accounts"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assets_tenantId_idx" ON "assets"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_depreciation_logs_tenantId_idx" ON "asset_depreciation_logs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salaries_tenantId_idx" ON "salaries"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salary_components_tenantId_idx" ON "salary_components"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salary_details_tenantId_idx" ON "salary_details"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salary_revisions_tenantId_idx" ON "salary_revisions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_salary_components_tenantId_idx" ON "user_salary_components"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_materials_tenantId_idx" ON "work_order_materials"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "work_order_template_items_tenantId_idx" ON "work_order_template_items"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mapping_nodes_tenantId_idx" ON "mapping_nodes"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mapping_edges_tenantId_idx" ON "mapping_edges"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "map_settings_tenantId_idx" ON "map_settings"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_projects_tenantId_idx" ON "rab_projects"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_revisions_tenantId_idx" ON "rab_revisions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_revision_approvals_tenantId_idx" ON "rab_revision_approvals"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_revision_items_tenantId_idx" ON "rab_revision_items"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_approvals_tenantId_idx" ON "rab_approvals"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_items_tenantId_idx" ON "rab_items"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_wbs_tenantId_idx" ON "rab_wbs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_disbursements_tenantId_idx" ON "rab_disbursements"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "acs_vendors_tenantId_idx" ON "acs_vendors"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "acs_wifi_security_tenantId_idx" ON "acs_wifi_security"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_bank_accounts_tenantId_idx" ON "company_bank_accounts"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rab_actual_achievements_tenantId_idx" ON "rab_actual_achievements"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_loans_tenantId_idx" ON "employee_loans"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_payments_tenantId_idx" ON "loan_payments"("tenantId");

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ARAgingSnapshot_tenantId_fkey') THEN
ALTER TABLE "ARAgingSnapshot" ADD CONSTRAINT "ARAgingSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Announcement_tenantId_fkey') THEN
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnnouncementRead_tenantId_fkey') THEN
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attendance_tenantId_fkey') THEN
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_locations_tenantId_fkey') THEN
ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bandwidth_tenantId_fkey') THEN
ALTER TABLE "Bandwidth" ADD CONSTRAINT "Bandwidth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Coupon_tenantId_fkey') THEN
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CouponUsage_tenantId_fkey') THEN
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerCohort_tenantId_fkey') THEN
ALTER TABLE "CustomerCohort" ADD CONSTRAINT "CustomerCohort_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseCategory_tenantId_fkey') THEN
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_tenantId_fkey') THEN
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HargaPaket_tenantId_fkey') THEN
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Investor_tenantId_fkey') THEN
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvestorPayout_tenantId_fkey') THEN
ALTER TABLE "InvestorPayout" ADD CONSTRAINT "InvestorPayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RabInvestor_tenantId_fkey') THEN
ALTER TABLE "RabInvestor" ADD CONSTRAINT "RabInvestor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Holiday_tenantId_fkey') THEN
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Joinbox_tenantId_fkey') THEN
ALTER TABLE "Joinbox" ADD CONSTRAINT "Joinbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JoinboxInput_tenantId_fkey') THEN
ALTER TABLE "JoinboxInput" ADD CONSTRAINT "JoinboxInput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JoinboxOutput_tenantId_fkey') THEN
ALTER TABLE "JoinboxOutput" ADD CONSTRAINT "JoinboxOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KmzFile_tenantId_fkey') THEN
ALTER TABLE "KmzFile" ADD CONSTRAINT "KmzFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequest_tenantId_fkey') THEN
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveBalance_tenantId_fkey') THEN
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MRRMovement_tenantId_fkey') THEN
ALTER TABLE "MRRMovement" ADD CONSTRAINT "MRRMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MikroTikRouter_tenantId_fkey') THEN
ALTER TABLE "MikroTikRouter" ADD CONSTRAINT "MikroTikRouter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Odc_tenantId_fkey') THEN
ALTER TABLE "Odc" ADD CONSTRAINT "Odc_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OdcOutput_tenantId_fkey') THEN
ALTER TABLE "OdcOutput" ADD CONSTRAINT "OdcOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Odp_tenantId_fkey') THEN
ALTER TABLE "Odp" ADD CONSTRAINT "Odp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OdpOutput_tenantId_fkey') THEN
ALTER TABLE "OdpOutput" ADD CONSTRAINT "OdpOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Otb_tenantId_fkey') THEN
ALTER TABLE "Otb" ADD CONSTRAINT "Otb_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OtbCore_tenantId_fkey') THEN
ALTER TABLE "OtbCore" ADD CONSTRAINT "OtbCore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Overtime_tenantId_fkey') THEN
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pelanggan_tenantId_fkey') THEN
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Permission_tenantId_fkey') THEN
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pole_tenantId_fkey') THEN
ALTER TABLE "Pole" ADD CONSTRAINT "Pole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfilePPP_tenantId_fkey') THEN
ALTER TABLE "ProfilePPP" ADD CONSTRAINT "ProfilePPP_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReminderLog_tenantId_fkey') THEN
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevenueSnapshot_tenantId_fkey') THEN
ALTER TABLE "RevenueSnapshot" ADD CONSTRAINT "RevenueSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_tenantId_fkey') THEN
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Settings_tenantId_fkey') THEN
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemLog_tenantId_fkey') THEN
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_tenantId_fkey') THEN
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sites_tenantId_fkey') THEN
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barang_tenantId_fkey') THEN
ALTER TABLE "barang" ADD CONSTRAINT "barang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barang_gudang_tenantId_fkey') THEN
ALTER TABLE "barang_gudang" ADD CONSTRAINT "barang_gudang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barang_keluar_tenantId_fkey') THEN
ALTER TABLE "barang_keluar" ADD CONSTRAINT "barang_keluar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barang_masuk_tenantId_fkey') THEN
ALTER TABLE "barang_masuk" ADD CONSTRAINT "barang_masuk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuration_restores_tenantId_fkey') THEN
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_usage_tenantId_fkey') THEN
ALTER TABLE "customer_usage" ADD CONSTRAINT "customer_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_tenantId_fkey') THEN
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_backups_tenantId_fkey') THEN
ALTER TABLE "device_backups" ADD CONSTRAINT "device_backups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gudang_tenantId_fkey') THEN
ALTER TABLE "gudang" ADD CONSTRAINT "gudang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_alerts_tenantId_fkey') THEN
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_performance_tenantId_fkey') THEN
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_tenantId_fkey') THEN
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_provider_configs_tenantId_fkey') THEN
ALTER TABLE "oauth_provider_configs" ADD CONSTRAINT "oauth_provider_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positions_tenantId_fkey') THEN
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_tenantId_fkey') THEN
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registrations_tenantId_fkey') THEN
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restock_alerts_tenantId_fkey') THEN
ALTER TABLE "restock_alerts" ADD CONSTRAINT "restock_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restock_settings_tenantId_fkey') THEN
ALTER TABLE "restock_settings" ADD CONSTRAINT "restock_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_suspension_tenantId_fkey') THEN
ALTER TABLE "service_suspension" ADD CONSTRAINT "service_suspension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_tenantId_fkey') THEN
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sla_tenantId_fkey') THEN
ALTER TABLE "sla" ADD CONSTRAINT "sla_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_opname_tenantId_fkey') THEN
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_tenantId_fkey') THEN
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_replies_tenantId_fkey') THEN
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfer_antar_gudang_tenantId_fkey') THEN
ALTER TABLE "transfer_antar_gudang" ADD CONSTRAINT "transfer_antar_gudang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_analytics_tenantId_fkey') THEN
ALTER TABLE "usage_analytics" ADD CONSTRAINT "usage_analytics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_assignments_tenantId_fkey') THEN
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_attachments_tenantId_fkey') THEN
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_escalations_tenantId_fkey') THEN
ALTER TABLE "work_order_escalations" ADD CONSTRAINT "work_order_escalations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_tasks_tenantId_fkey') THEN
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_templates_tenantId_fkey') THEN
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_updates_tenantId_fkey') THEN
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_tenantId_fkey') THEN
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_material_returns_tenantId_fkey') THEN
ALTER TABLE "work_order_material_returns" ADD CONSTRAINT "work_order_material_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_tenantId_fkey') THEN
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConversationParticipant_tenantId_fkey') THEN
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_tenantId_fkey') THEN
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_versions_tenantId_fkey') THEN
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shift_tenantId_fkey') THEN
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canvasing_tenantId_fkey') THEN
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_claims_tenantId_fkey') THEN
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_requests_tenantId_fkey') THEN
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_request_items_tenantId_fkey') THEN
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_tenantId_fkey') THEN
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_tenantId_fkey') THEN
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_tenantId_fkey') THEN
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_accounts_tenantId_fkey') THEN
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_tenantId_fkey') THEN
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_depreciation_logs_tenantId_fkey') THEN
ALTER TABLE "asset_depreciation_logs" ADD CONSTRAINT "asset_depreciation_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salaries_tenantId_fkey') THEN
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_components_tenantId_fkey') THEN
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_details_tenantId_fkey') THEN
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_revisions_tenantId_fkey') THEN
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_salary_components_tenantId_fkey') THEN
ALTER TABLE "user_salary_components" ADD CONSTRAINT "user_salary_components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_materials_tenantId_fkey') THEN
ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_template_items_tenantId_fkey') THEN
ALTER TABLE "work_order_template_items" ADD CONSTRAINT "work_order_template_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mapping_nodes_tenantId_fkey') THEN
ALTER TABLE "mapping_nodes" ADD CONSTRAINT "mapping_nodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mapping_edges_tenantId_fkey') THEN
ALTER TABLE "mapping_edges" ADD CONSTRAINT "mapping_edges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'map_settings_tenantId_fkey') THEN
ALTER TABLE "map_settings" ADD CONSTRAINT "map_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_projects_tenantId_fkey') THEN
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_revisions_tenantId_fkey') THEN
ALTER TABLE "rab_revisions" ADD CONSTRAINT "rab_revisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_revision_approvals_tenantId_fkey') THEN
ALTER TABLE "rab_revision_approvals" ADD CONSTRAINT "rab_revision_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_revision_items_tenantId_fkey') THEN
ALTER TABLE "rab_revision_items" ADD CONSTRAINT "rab_revision_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_approvals_tenantId_fkey') THEN
ALTER TABLE "rab_approvals" ADD CONSTRAINT "rab_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_items_tenantId_fkey') THEN
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_wbs_tenantId_fkey') THEN
ALTER TABLE "rab_wbs" ADD CONSTRAINT "rab_wbs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_disbursements_tenantId_fkey') THEN
ALTER TABLE "rab_disbursements" ADD CONSTRAINT "rab_disbursements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acs_vendors_tenantId_fkey') THEN
ALTER TABLE "acs_vendors" ADD CONSTRAINT "acs_vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acs_wifi_security_tenantId_fkey') THEN
ALTER TABLE "acs_wifi_security" ADD CONSTRAINT "acs_wifi_security_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_bank_accounts_tenantId_fkey') THEN
ALTER TABLE "company_bank_accounts" ADD CONSTRAINT "company_bank_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rab_actual_achievements_tenantId_fkey') THEN
ALTER TABLE "rab_actual_achievements" ADD CONSTRAINT "rab_actual_achievements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_loans_tenantId_fkey') THEN
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loan_payments_tenantId_fkey') THEN
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

