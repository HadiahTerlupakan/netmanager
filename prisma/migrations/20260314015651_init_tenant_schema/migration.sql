-- @safe-guard-ack: Adding Tenant model and tenantId for Multi-Tenant SaaS architecture
-- AlterTable
ALTER TABLE "ARAgingSnapshot" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AnnouncementRead" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "employee_locations" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Bandwidth" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CouponUsage" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CustomerCohort" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "HargaPaket" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvestorPayout" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RabInvestor" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Joinbox" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "JoinboxInput" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "JoinboxOutput" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "KmzFile" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveBalance" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MRRMovement" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MikroTikRouter" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Odc" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OdcOutput" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Odp" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OdpOutput" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Otb" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OtbCore" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Overtime" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Pole" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ProfilePPP" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ReminderLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RevenueSnapshot" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SystemLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "user_sites" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang_gudang" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang_keluar" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "barang_masuk" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "configuration_restores" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "customer_usage" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "device_backups" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "gudang" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "network_alerts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "network_performance" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "restock_alerts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "restock_settings" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "service_suspension" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "sla" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "stock_opname" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ticket_replies" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "transfer_antar_gudang" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "usage_analytics" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_assignments" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_attachments" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_escalations" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_tasks" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_templates" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_updates" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_material_returns" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "app_versions" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "canvasing" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "point_claims" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_request_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "financial_accounts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "asset_depreciation_logs" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salaries" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salary_components" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salary_details" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "salary_revisions" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "user_salary_components" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_materials" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "work_order_template_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mapping_nodes" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mapping_edges" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "map_settings" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_projects" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_revisions" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_revision_approvals" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_revision_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_approvals" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_wbs" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_disbursements" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "acs_vendors" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "acs_wifi_security" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "company_bank_accounts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rab_actual_achievements" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "employee_loans" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "loan_payments" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "ARAgingSnapshot_tenantId_idx" ON "ARAgingSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "Announcement_tenantId_idx" ON "Announcement"("tenantId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_tenantId_idx" ON "AnnouncementRead"("tenantId");

-- CreateIndex
CREATE INDEX "Attendance_tenantId_idx" ON "Attendance"("tenantId");

-- CreateIndex
CREATE INDEX "employee_locations_tenantId_idx" ON "employee_locations"("tenantId");

-- CreateIndex
CREATE INDEX "Bandwidth_tenantId_idx" ON "Bandwidth"("tenantId");

-- CreateIndex
CREATE INDEX "Coupon_tenantId_idx" ON "Coupon"("tenantId");

-- CreateIndex
CREATE INDEX "CouponUsage_tenantId_idx" ON "CouponUsage"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerCohort_tenantId_idx" ON "CustomerCohort"("tenantId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_tenantId_idx" ON "ExpenseCategory"("tenantId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_idx" ON "Expense"("tenantId");

-- CreateIndex
CREATE INDEX "HargaPaket_tenantId_idx" ON "HargaPaket"("tenantId");

-- CreateIndex
CREATE INDEX "Investor_tenantId_idx" ON "Investor"("tenantId");

-- CreateIndex
CREATE INDEX "InvestorPayout_tenantId_idx" ON "InvestorPayout"("tenantId");

-- CreateIndex
CREATE INDEX "RabInvestor_tenantId_idx" ON "RabInvestor"("tenantId");

-- CreateIndex
CREATE INDEX "Holiday_tenantId_idx" ON "Holiday"("tenantId");

-- CreateIndex
CREATE INDEX "Joinbox_tenantId_idx" ON "Joinbox"("tenantId");

-- CreateIndex
CREATE INDEX "JoinboxInput_tenantId_idx" ON "JoinboxInput"("tenantId");

-- CreateIndex
CREATE INDEX "JoinboxOutput_tenantId_idx" ON "JoinboxOutput"("tenantId");

-- CreateIndex
CREATE INDEX "KmzFile_tenantId_idx" ON "KmzFile"("tenantId");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_idx" ON "LeaveRequest"("tenantId");

-- CreateIndex
CREATE INDEX "LeaveBalance_tenantId_idx" ON "LeaveBalance"("tenantId");

-- CreateIndex
CREATE INDEX "MRRMovement_tenantId_idx" ON "MRRMovement"("tenantId");

-- CreateIndex
CREATE INDEX "MikroTikRouter_tenantId_idx" ON "MikroTikRouter"("tenantId");

-- CreateIndex
CREATE INDEX "Odc_tenantId_idx" ON "Odc"("tenantId");

-- CreateIndex
CREATE INDEX "OdcOutput_tenantId_idx" ON "OdcOutput"("tenantId");

-- CreateIndex
CREATE INDEX "Odp_tenantId_idx" ON "Odp"("tenantId");

-- CreateIndex
CREATE INDEX "OdpOutput_tenantId_idx" ON "OdpOutput"("tenantId");

-- CreateIndex
CREATE INDEX "Otb_tenantId_idx" ON "Otb"("tenantId");

-- CreateIndex
CREATE INDEX "OtbCore_tenantId_idx" ON "OtbCore"("tenantId");

-- CreateIndex
CREATE INDEX "Overtime_tenantId_idx" ON "Overtime"("tenantId");

-- CreateIndex
CREATE INDEX "Pelanggan_tenantId_idx" ON "Pelanggan"("tenantId");

-- CreateIndex
CREATE INDEX "Permission_tenantId_idx" ON "Permission"("tenantId");

-- CreateIndex
CREATE INDEX "Pole_tenantId_idx" ON "Pole"("tenantId");

-- CreateIndex
CREATE INDEX "ProfilePPP_tenantId_idx" ON "ProfilePPP"("tenantId");

-- CreateIndex
CREATE INDEX "ReminderLog_tenantId_idx" ON "ReminderLog"("tenantId");

-- CreateIndex
CREATE INDEX "RevenueSnapshot_tenantId_idx" ON "RevenueSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE INDEX "Settings_tenantId_idx" ON "Settings"("tenantId");

-- CreateIndex
CREATE INDEX "SystemLog_tenantId_idx" ON "SystemLog"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "user_sites_tenantId_idx" ON "user_sites"("tenantId");

-- CreateIndex
CREATE INDEX "barang_tenantId_idx" ON "barang"("tenantId");

-- CreateIndex
CREATE INDEX "barang_gudang_tenantId_idx" ON "barang_gudang"("tenantId");

-- CreateIndex
CREATE INDEX "barang_keluar_tenantId_idx" ON "barang_keluar"("tenantId");

-- CreateIndex
CREATE INDEX "barang_masuk_tenantId_idx" ON "barang_masuk"("tenantId");

-- CreateIndex
CREATE INDEX "configuration_restores_tenantId_idx" ON "configuration_restores"("tenantId");

-- CreateIndex
CREATE INDEX "customer_usage_tenantId_idx" ON "customer_usage"("tenantId");

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE INDEX "device_backups_tenantId_idx" ON "device_backups"("tenantId");

-- CreateIndex
CREATE INDEX "gudang_tenantId_idx" ON "gudang"("tenantId");

-- CreateIndex
CREATE INDEX "network_alerts_tenantId_idx" ON "network_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "network_performance_tenantId_idx" ON "network_performance"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "positions_tenantId_idx" ON "positions"("tenantId");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenantId_idx" ON "push_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "registrations_tenantId_idx" ON "registrations"("tenantId");

-- CreateIndex
CREATE INDEX "restock_alerts_tenantId_idx" ON "restock_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "restock_settings_tenantId_idx" ON "restock_settings"("tenantId");

-- CreateIndex
CREATE INDEX "service_suspension_tenantId_idx" ON "service_suspension"("tenantId");

-- CreateIndex
CREATE INDEX "sites_tenantId_idx" ON "sites"("tenantId");

-- CreateIndex
CREATE INDEX "sla_tenantId_idx" ON "sla"("tenantId");

-- CreateIndex
CREATE INDEX "stock_opname_tenantId_idx" ON "stock_opname"("tenantId");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_idx" ON "support_tickets"("tenantId");

-- CreateIndex
CREATE INDEX "ticket_replies_tenantId_idx" ON "ticket_replies"("tenantId");

-- CreateIndex
CREATE INDEX "transfer_antar_gudang_tenantId_idx" ON "transfer_antar_gudang"("tenantId");

-- CreateIndex
CREATE INDEX "usage_analytics_tenantId_idx" ON "usage_analytics"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_assignments_tenantId_idx" ON "work_order_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_attachments_tenantId_idx" ON "work_order_attachments"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_escalations_tenantId_idx" ON "work_order_escalations"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_tasks_tenantId_idx" ON "work_order_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_templates_tenantId_idx" ON "work_order_templates"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_updates_tenantId_idx" ON "work_order_updates"("tenantId");

-- CreateIndex
CREATE INDEX "work_orders_tenantId_idx" ON "work_orders"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_material_returns_tenantId_idx" ON "work_order_material_returns"("tenantId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_idx" ON "Conversation"("tenantId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_tenantId_idx" ON "ConversationParticipant"("tenantId");

-- CreateIndex
CREATE INDEX "Message_tenantId_idx" ON "Message"("tenantId");

-- CreateIndex
CREATE INDEX "app_versions_tenantId_idx" ON "app_versions"("tenantId");

-- CreateIndex
CREATE INDEX "Shift_tenantId_idx" ON "Shift"("tenantId");

-- CreateIndex
CREATE INDEX "canvasing_tenantId_idx" ON "canvasing"("tenantId");

-- CreateIndex
CREATE INDEX "point_claims_tenantId_idx" ON "point_claims"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_requests_tenantId_idx" ON "purchase_requests"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_request_items_tenantId_idx" ON "purchase_request_items"("tenantId");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_idx" ON "purchase_orders"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_order_items_tenantId_idx" ON "purchase_order_items"("tenantId");

-- CreateIndex
CREATE INDEX "financial_accounts_tenantId_idx" ON "financial_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "assets_tenantId_idx" ON "assets"("tenantId");

-- CreateIndex
CREATE INDEX "asset_depreciation_logs_tenantId_idx" ON "asset_depreciation_logs"("tenantId");

-- CreateIndex
CREATE INDEX "salaries_tenantId_idx" ON "salaries"("tenantId");

-- CreateIndex
CREATE INDEX "salary_components_tenantId_idx" ON "salary_components"("tenantId");

-- CreateIndex
CREATE INDEX "salary_details_tenantId_idx" ON "salary_details"("tenantId");

-- CreateIndex
CREATE INDEX "salary_revisions_tenantId_idx" ON "salary_revisions"("tenantId");

-- CreateIndex
CREATE INDEX "user_salary_components_tenantId_idx" ON "user_salary_components"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_materials_tenantId_idx" ON "work_order_materials"("tenantId");

-- CreateIndex
CREATE INDEX "work_order_template_items_tenantId_idx" ON "work_order_template_items"("tenantId");

-- CreateIndex
CREATE INDEX "mapping_nodes_tenantId_idx" ON "mapping_nodes"("tenantId");

-- CreateIndex
CREATE INDEX "mapping_edges_tenantId_idx" ON "mapping_edges"("tenantId");

-- CreateIndex
CREATE INDEX "map_settings_tenantId_idx" ON "map_settings"("tenantId");

-- CreateIndex
CREATE INDEX "rab_projects_tenantId_idx" ON "rab_projects"("tenantId");

-- CreateIndex
CREATE INDEX "rab_revisions_tenantId_idx" ON "rab_revisions"("tenantId");

-- CreateIndex
CREATE INDEX "rab_revision_approvals_tenantId_idx" ON "rab_revision_approvals"("tenantId");

-- CreateIndex
CREATE INDEX "rab_revision_items_tenantId_idx" ON "rab_revision_items"("tenantId");

-- CreateIndex
CREATE INDEX "rab_approvals_tenantId_idx" ON "rab_approvals"("tenantId");

-- CreateIndex
CREATE INDEX "rab_items_tenantId_idx" ON "rab_items"("tenantId");

-- CreateIndex
CREATE INDEX "rab_wbs_tenantId_idx" ON "rab_wbs"("tenantId");

-- CreateIndex
CREATE INDEX "rab_disbursements_tenantId_idx" ON "rab_disbursements"("tenantId");

-- CreateIndex
CREATE INDEX "acs_vendors_tenantId_idx" ON "acs_vendors"("tenantId");

-- CreateIndex
CREATE INDEX "acs_wifi_security_tenantId_idx" ON "acs_wifi_security"("tenantId");

-- CreateIndex
CREATE INDEX "company_bank_accounts_tenantId_idx" ON "company_bank_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "rab_actual_achievements_tenantId_idx" ON "rab_actual_achievements"("tenantId");

-- CreateIndex
CREATE INDEX "employee_loans_tenantId_idx" ON "employee_loans"("tenantId");

-- CreateIndex
CREATE INDEX "loan_payments_tenantId_idx" ON "loan_payments"("tenantId");

-- AddForeignKey
ALTER TABLE "ARAgingSnapshot" ADD CONSTRAINT "ARAgingSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bandwidth" ADD CONSTRAINT "Bandwidth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCohort" ADD CONSTRAINT "CustomerCohort_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorPayout" ADD CONSTRAINT "InvestorPayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RabInvestor" ADD CONSTRAINT "RabInvestor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Joinbox" ADD CONSTRAINT "Joinbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinboxInput" ADD CONSTRAINT "JoinboxInput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinboxOutput" ADD CONSTRAINT "JoinboxOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KmzFile" ADD CONSTRAINT "KmzFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRRMovement" ADD CONSTRAINT "MRRMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikroTikRouter" ADD CONSTRAINT "MikroTikRouter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odc" ADD CONSTRAINT "Odc_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdcOutput" ADD CONSTRAINT "OdcOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odp" ADD CONSTRAINT "Odp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdpOutput" ADD CONSTRAINT "OdpOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Otb" ADD CONSTRAINT "Otb_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtbCore" ADD CONSTRAINT "OtbCore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pole" ADD CONSTRAINT "Pole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePPP" ADD CONSTRAINT "ProfilePPP_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueSnapshot" ADD CONSTRAINT "RevenueSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang" ADD CONSTRAINT "barang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_gudang" ADD CONSTRAINT "barang_gudang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_keluar" ADD CONSTRAINT "barang_keluar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_masuk" ADD CONSTRAINT "barang_masuk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_usage" ADD CONSTRAINT "customer_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_backups" ADD CONSTRAINT "device_backups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gudang" ADD CONSTRAINT "gudang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_provider_configs" ADD CONSTRAINT "oauth_provider_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_alerts" ADD CONSTRAINT "restock_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_settings" ADD CONSTRAINT "restock_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_suspension" ADD CONSTRAINT "service_suspension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla" ADD CONSTRAINT "sla_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_antar_gudang" ADD CONSTRAINT "transfer_antar_gudang_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_analytics" ADD CONSTRAINT "usage_analytics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_escalations" ADD CONSTRAINT "work_order_escalations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_material_returns" ADD CONSTRAINT "work_order_material_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation_logs" ADD CONSTRAINT "asset_depreciation_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_salary_components" ADD CONSTRAINT "user_salary_components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_template_items" ADD CONSTRAINT "work_order_template_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_nodes" ADD CONSTRAINT "mapping_nodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_edges" ADD CONSTRAINT "mapping_edges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_settings" ADD CONSTRAINT "map_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revisions" ADD CONSTRAINT "rab_revisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_approvals" ADD CONSTRAINT "rab_revision_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_items" ADD CONSTRAINT "rab_revision_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_approvals" ADD CONSTRAINT "rab_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_wbs" ADD CONSTRAINT "rab_wbs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_disbursements" ADD CONSTRAINT "rab_disbursements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acs_vendors" ADD CONSTRAINT "acs_vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acs_wifi_security" ADD CONSTRAINT "acs_wifi_security_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_bank_accounts" ADD CONSTRAINT "company_bank_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_actual_achievements" ADD CONSTRAINT "rab_actual_achievements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

