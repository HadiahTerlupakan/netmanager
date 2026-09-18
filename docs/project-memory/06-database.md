# Database Schema Analysis - NetManager ISP System

**Generated**: 2026-08-09  
**Total Migrations**: 84  
**Total Tables**: 218 (Main) + 11 (Billing) + 7 (Radius) + 8 (Mitra)  
**Architecture**: Multi-Database, Multi-Tenant SaaS

---

## Executive Summary

NetManager menggunakan **4 database terpisah** dengan arsitektur multi-tenant:

1. **Main Database** (`schema.prisma`) - 218 tables - Core business logic, ISP operations
2. **Billing Database** (`billing.prisma`) - 11 tables - Invoice, payment, webhook processing
3. **RADIUS Database** (`schema.radius.prisma`) - 7 tables - FreeRADIUS authentication/accounting
4. **Mitra Database** (`mitra.prisma`) - 8 tables - Partner/technician management & wallet

**Multi-Tenancy Strategy**: `tenantId` field di hampir semua tables untuk data isolation per-tenant.

---

## I. MAIN DATABASE - Core Tables (218 Tables)

### A. Central Hub Tables (Most Relationships)

**Top 10 Hub Tables** berdasarkan jumlah foreign key relationships:

1. **`Tenant`** (85 relations) - Root entity untuk multi-tenancy
2. **`User`** (52 relations) - Employee/admin management
3. **`Sites`** (17 relations) - Physical site/location management
4. **`Pelanggan`** (12 relations) - Customer entity
5. **`WorkOrders`** (11 relations) - Work order lifecycle
6. **`HargaPaket`** (8 relations) - Service package pricing
7. **`Gudang`** (10 relations) - Warehouse/inventory location
8. **`Barang`** (14 relations) - Inventory items
9. **`RabProject`** (8 relations) - Budget project planning
10. **`MikroTikRouter`** (5 relations) - Network device management

### B. Domain Breakdown by Business Function

#### 1. **Customer Management Domain**

**Core Tables**:
- `Pelanggan` (Customer master) - 1002 lines, central customer entity
  - PK: `id` (String, UUID)
  - UK: `username`, `tenantId + idPelanggan`
  - FK: `hargaPaketId` → HargaPaket, `odpId` → Odp, `siteId` → Sites
  - Relations: 12 tables (invoices, payments, work orders, usage, support tickets)
  - Multi-tenancy: `tenantId` + unique constraints
  - Features: PPPoE credentials, billing settings, discount config, reseller assignment

- `Registrations` - Lead/prospect management
- `Canvasing` - Sales canvassing with location tracking
- `PointClaim` - Sales point/commission system

**Key Patterns**:
- Soft delete via `deletedAt` on reseller tables
- Status tracking: `AKTIF`, `NONAKTIF`, `MAINTENANCE`, `ISOLIR`, `DISMANTLE`
- Reseller hierarchy: `Reseller` → `ResellerOutlet` → `Pelanggan`

#### 2. **Billing & Finance Domain**

**Core Tables** (Main DB):
- `Coupon` & `CouponUsage` - Discount/promo management
- `Expense` & `ExpenseCategory` - Operational expenses
- `FinancialAccount` - Cash/bank accounts
- `CustomerCohort` - Cohort analysis for retention
- `ARAgingSnapshot` - Accounts receivable aging
- `RevenueSnapshot` - MRR/ARR tracking
- `MRRMovement` - Revenue movement tracking

**Billing DB Tables** (Separate database):
- `Invoice` & `InvoiceItem` - Invoice generation
- `Payment` - Payment records with gateway integration
- `PaymentGatewayConfig` - Multi-gateway support
- `BillingSchedule` - Scheduled billing jobs (overdue, isolir)
- `UnmatchedMutation` - Bank mutation matching
- `WebhookEvent` - Payment gateway webhooks

**Key Patterns**:
- Idempotency: `dedupeKey` on BillingSchedule
- Webhook handling: idempotency via `idempotencyKey`
- Payment gateway abstraction with status tracking
- Scheduled jobs for auto-isolir and overdue marking

#### 3. **Accounting Module** (GL/COA)

**Core Tables**:
- `ChartOfAccount` - Chart of accounts with tree structure
- `AccountingPeriod` - Fiscal period management
- `JournalEntry` & `JournalLine` - Double-entry bookkeeping
- `RecurringJournalTemplate` - Recurring journal automation
- `BankReconciliation` & `BankReconciliationLine` - Bank rec

**Key Features**:
- Double-entry accounting with DEBIT/CREDIT sides
- Automatic journal creation from business events (AUTO_INVOICE_PAID, AUTO_EXPENSE, etc.)
- Reversal support with `reversalOfId` tracking
- Period locking mechanism
- Cash flow categorization (OPERATING, INVESTING, FINANCING)

#### 4. **Tax Management Module**

**Core Tables**:
- `TaxConfig` - Tenant tax configuration (NPWP, PKP status)
- `TaxTransaction` - Tax transactions with faktur pajak tracking
- `TaxPeriodSummary` - Monthly tax summary (PPN, PPh 21/23/4)
- `TaxReminder` - Automated tax deadline reminders
- `TaxRateConfig` - Flexible tax rates per tenant

**Tax Types Supported**:
- PPN (VAT) - Input & Output
- PPh 21 (Income tax employees)
- PPh 23 (Income tax services/rent)
- PPh 4(2) (Final income tax)
- BHP & USO (Telecommunication levies)

#### 5. **HR & Payroll Domain**

**Attendance Management**:
- `Attendance` - Check-in/out with geofence validation
- `AttendanceEvaluation` - Daily work evaluation (single source of truth)
- `AttendanceEvaluationAudit` - Audit trail for corrections
- `Overtime` & `OvertimeAutoCheckoutSchedule` - Overtime tracking
- `LeaveRequest` & `LeaveBalance` - Leave management with auto-reject rules
- `EmployeeLocation` - Real-time GPS tracking

**Payroll System V2** (New architecture):
- `PaySchedule` - Pay frequency configuration
- `PayrollPeriod` - Period management with locking
- `PayrollRun` - Payroll run lifecycle
- `PayrollEntry` & `PayrollLine` - Employee salary calculation
- `PayrollComponent` - Configurable salary components
- `EmployeePayrollProfile` - Employee payroll config
- `SalaryAdvance` - Advance salary with installment tracking
- `RegionalMinimumWage` - UMR/UMK reference data
- `PayrollAuditLog` - Full audit trail

**Legacy Salary System** (Being phased out):
- `Salary`, `SalaryDetail`, `SalaryComponent`, `UserSalaryComponent`
- `EmployeeLoan` & `LoanPayment`

**Shift Management**:
- `Shift` - Shift definitions
- `Holiday` - Holiday calendar

#### 6. **Inventory & Procurement Domain**

**Inventory Management**:
- `Barang` - Inventory master (with asset/consumable flag)
- `BarangGudang` - Stock per warehouse with condition tracking
- `BarangMasuk` & `BarangKeluar` - Stock movements
- `Gudang` - Warehouse/storage locations
- `TransferAntarGudang` - Inter-warehouse transfers
- `StockOpname` - Stock taking/physical count
- `RestockAlerts` & `RestockSettings` - Auto-restock alerts
- `UsageAnalytics` - Usage pattern analysis
- `Asset` & `AssetDepreciationLog` - Fixed asset tracking

**Procurement Workflow**:
- `PurchaseRequest` & `PurchaseRequestItem` - Purchase requests
- `PurchaseRequestJasaItem` - Service procurement items
- `Jasa` - Service master (non-physical items)
- `Supplier` - Vendor management with blacklist support
- `PurchaseOrder` & `PurchaseOrderItem` - Purchase orders
- `PurchaseOrderJasaItem` - Service items in PO
- `GoodsReceipt` & `GoodsReceiptItem` - Goods receiving
- `GoodsReturn` & `GoodsReturnItem` - Return to vendor (RTV)
- `ApprovalThreshold` - Approval matrix by role & amount

**Key Features**:
- Multi-condition tracking: NEW, USED, DAMAGED
- Actor polymorphism: `actorType` + `actorId` for non-user actors
- Photo evidence: `fotoBukti` arrays with metadata
- Approval workflows with threshold matrix

#### 7. **Work Order Management**

**Core Tables**:
- `WorkOrders` - Work order master (1000+ lines)
- `WorkOrderAssignments` - Multi-assignee support (employee + mitra)
- `WorkOrderTasks` - Task checklist
- `WorkOrderAttachments` - Photo/document attachments
- `WorkOrderUpdates` - Activity timeline
- `WorkOrderMaterial` - Material usage tracking
- `WorkOrderMaterialReturn` - Material return workflow
- `WorkOrderTemplates` & `WorkOrderTemplateItem` - Templates
- `Sla` - SLA definitions by type/priority
- `WorkOrderEscalations` - Auto-escalation rules

**Work Order Types**:
- INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION

**Status Flow**:
PENDING → ASSIGNED → IN_PROGRESS → ON_HOLD → COMPLETED → VERIFIED → CLOSED

**Warranty Support**:
- `isWarranty`, `warrantyOwnerId` (mitra), `warrantySla` fields

#### 8. **Network Infrastructure Domain**

**Physical Network**:
- `Otb` → `OtbCore` - Optical Terminal Box
- `Odc` → `OdcOutput` - Optical Distribution Cabinet
- `Odp` → `OdpOutput` - Optical Distribution Point (connected to customers)
- `Joinbox` → `JoinboxInput`/`JoinboxOutput` - Fiber joinboxes
- `Pole` - Utility poles
- `KmzFile` - KML/KMZ overlay files for maps

**Network Devices**:
- `MikroTikRouter` - MikroTik PPPoE/Hotspot routers
- `AccelPppServer` - Accel-PPP servers for PPPoE
- `ProfilePPP` - PPPoE profiles with IP pools
- `Bandwidth` - Bandwidth profiles

**OLT/ONU Provisioning** (GPON/FTTH): modulnya dihapus 2026-09-17 dan 9 tabel `olt_*`/`onu_*`
beserta enum-nya di-drop 2026-09-18 (`20260918000116_drop_mixradius_columns_and_olt_tables`).

**Device Management**:
- `DeviceBackups` - Configuration backups
- `ConfigurationRestores` - Restore operations
- `NetworkPerformance` - Performance metrics
- `NetworkAlerts` - Device alerts

**Network Mapping**:
- `MappingNode` & `MappingEdge` - Network topology graph
- `MapSettings` - Map configuration

#### 9. **Support & Ticketing**

**Core Tables**:
- `SupportTickets` - Customer support tickets
- `TicketReplies` - Ticket conversation thread
- `Incident` & `IncidentUpdate` - Network incident tracking (status page)
- `ServiceSuspension` - Service suspension tracking
- `CustomerUsage` - Customer bandwidth usage logs

**Integration**:
- Tickets dapat di-convert menjadi WorkOrder
- Status page untuk customer-facing incident reporting

#### 10. **User & Access Management**

**Core Tables**:
- `User` - Employee/admin master (1539 lines, massive)
- `Role` - Roles with permission sets
- `Permission` - Granular permissions (resource + action)
- `Departments` & `Positions` - Organizational structure
- `Session` - NextAuth session management
- `Account` - OAuth provider accounts
- `VerificationToken` - Email verification
- `SystemLog` - Audit log with actor polymorphism

**User Features**:
- Working hour modes: FIXED, SHIFT, FLEXIBLE
- Multi-site assignment via `UserSite`
- Push notification tokens (FCM)
- App version tracking
- Salary configuration embedded in User model

#### 11. **Partner/Mitra Management** (Separate DB)

**Mitra Database Tables**:
- `Mitra` - Partner/technician master
- `MitraWallet` - Digital wallet for commissions
- `MitraTransaction` - Wallet transactions
- `WithdrawRequest` - Withdrawal requests
- `FaceVerificationLog` - Face verification for check-in

**Commission Types**:
- WO PSB (Installation)
- WO Maintenance
- Canvasing installed

**Key Features**:
- Warranty system with penalties
- Bank account management for payouts

#### 12. **Project & Budget Management**

**RAB (Budget) System**:
- `RabProject` - Budget project master
- `RabRevision` & `RabRevisionItem` - Multi-revision support
- `RabItem` - Budget line items
- `RabWbs` - Work breakdown structure
- `RabDisbursement` - Disbursement schedule
- `RabApproval` & `RabRevisionApproval` - Multi-level approval
- `RabActualAchievement` - Actual vs budget tracking
- `RabInvestor` - Investor allocation per project

**Planning Module** (OSP - Outside Plant):
- `Planning` - OSP planning master
- `PlanningItem` - Bill of materials
- `PlanningMilestone` - Milestone tracking
- `PlanningDocument` - Document attachments
- `PlanningAuditLog` - Full audit trail
- `PlanningTemplate` & `PlanningTemplateItem` - Templates

**Approval Workflow**:
- Multi-level approval (Level 1 → Final)
- Status: BACKLOG → PENDING_APPROVAL → APPROVED_LEVEL1 → APPROVED → IN_PROGRESS → COMPLETED

#### 13. **Investor Management**

**Core Tables**:
- `Investor` - Investor master
- `InvestorConfig` - Profit sharing configuration
- `InvestorDeposit` - Capital deposits
- `InvestorProfitShare` - Profit distribution
- `InvestorPayout` - Withdrawals/payouts

**Profit Sharing Modes**:
- FIXED percentage
- PROPORTIONAL (by deposit amount)
- TIERED_AFTER_BEP (different rates before/after break-even)

**Tax Integration**:
- Configurable tax deduction (PPh 23, PPh 4(2))
- Integration with accounting module

#### 14. **Notification & Communication**

**Core Tables**:
- `Notifications` - In-app notifications
- `ReminderLog` - Payment reminder logs
- `EmailDeliveryLog` - Email delivery tracking
- `NotificationDeadLetter` - Failed notification queue

**WhatsApp Integration**:
- `WhatsAppAccount` - Multi-account support
- `WhatsAppMessage` - Message delivery tracking
- Daily limit & rate limiting per account

**Chat System**:
- `Conversation` & `ConversationParticipant` - Multi-party chat
- `Message` - Chat messages
- Actor polymorphism for customer/mitra/admin

#### 15. **Mobile App Management**

**Core Tables**:
- `AppVersion` - APK version management (legacy)
- `AppUpdate` - OTA updates (Expo Updates)
- `AppRelease` - APK releases with rollout percentage
- `TenantSettings` - App update contact configuration

**Update Strategy**:
- OTA for JS/TS changes (no native code changes)
- APK for native changes (plugins, native modules)
- Fingerprint-based runtime version matching

#### 16. **Settings & Configuration**

**Core Tables**:
- `Settings` - Key-value settings per tenant
- `TenantSettings` - Structured tenant settings
- `Tenant` - Tenant master with domain
- `TenantDomain` - Custom domain management
- `TenantFeatureFlag` - Feature toggle per tenant
- `Sites` - Physical locations/branches

**Multi-Tenancy**:
- Domain-based tenant resolution
- Feature flags for module enable/disable
- Data isolation via `tenantId` foreign keys

#### 17. **Event Bus & Background Jobs**

**Core Tables**:
- `OutboxEvent` - Transactional outbox pattern
  - Status: PENDING → PROCESSING → COMPLETED / DEAD
  - Retry mechanism with max retries
  - Priority-based processing
  - Category-based routing

**Scheduled Jobs**:
- `BillingSchedule` - Billing-related scheduled jobs
  - INVOICE_MARK_OVERDUE
  - CUSTOMER_AUTO_ISOLIR
- Idempotency via `dedupeKey`

#### 18. **CMS & Landing Page**

**Core Tables**:
- `LandingHero` - Hero section
- `LandingFeature` - Feature highlights
- `LandingPricing` - Pricing plans
- `LandingTestimonial` - Customer testimonials
- `LandingFaq` - FAQ section
- `LandingFooter` - Footer content

**Multi-tenant Support**:
- Shared CMS tables (no tenantId)
- Custom branding per tenant via TenantSettings

---

### C. Critical Tables for Performance

**High-Volume Tables** (frequent writes, large datasets):

1. **`radacct`** (RADIUS DB) - PPPoE session accounting
   - Indexes: 10+ indexes on session tracking fields
   - Volume: Grows continuously with customer sessions

2. **`CustomerUsage`** - Bandwidth usage logs
   - Indexes on pelangganId, session times
   - Volume: Per-session records

3. **`Attendance`** - Daily check-in/out records
   - Indexes: 11 indexes for lookup optimization
   - Volume: Per-employee per-day

4. **`AttendanceEvaluation`** - Daily work evaluation (SOT)
   - Unique: tenantId + userId + workDate
   - Critical for payroll calculation

5. **`SystemLog`** - Audit trail
   - Indexes on userId, actorType/actorId, createdAt
   - Volume: Every user action

6. **`OutboxEvent`** - Event bus outbox
   - Indexes on status, scheduledAt, priority
   - High write volume for event-driven architecture

7. **`Payment`** - Payment transactions
   - Indexes on pelangganId, paymentDate, gatewayStatus
   - Financial critical data

8. **`Invoice`** & `InvoiceItem`** - Billing records
   - Indexes on pelangganId, dueDate, status
   - Monthly generation for all customers

9. **`NetworkPerformance`** - Device metrics
   - Time-series data per device
   - Retention policy needed

**Optimization Patterns**:
- Composite indexes for common query patterns
- Partial indexes on status fields
- Date-based partitioning candidates: `radacct`, `CustomerUsage`, `NetworkPerformance`
- Covering indexes for list queries

---

### D. Multi-Tenancy Implementation

**Tenant Isolation Strategy**:

1. **Column-based isolation**: `tenantId` field on all tenant-scoped tables
2. **Unique constraints**: Composite UK with `tenantId` to prevent cross-tenant conflicts
3. **Indexes**: `tenantId` indexed for query performance
4. **Foreign keys**: `onDelete: Restrict` to prevent accidental cascade deletes
5. **Query filtering**: Repository layer enforces `tenantId` filter

**Shared vs Tenant-specific**:

**Shared Tables** (no tenantId):
- `VerificationToken`
- `Session` (user-scoped)
- `LandingHero`, `LandingFeature`, etc. (CMS)
- `OutboxEvent` (internal events)

**Tenant-specific**: All business data tables with `tenantId` FK

**Multi-Database Strategy**:
- **Main DB**: Core business logic
- **Billing DB**: Invoice/payment isolation for scalability
- **RADIUS DB**: FreeRADIUS integration (standardized schema)
- **Mitra DB**: Partner data isolation

---

### E. Soft Delete Patterns

**Tables with Soft Delete** (`deletedAt` field):

1. **Reseller System**:
   - `Reseller`, `ResellerOutlet`, `ResellerPackagePrice`
   - `ResellerCommissionRule`, `ResellerCommission`, `ResellerSettlement`

2. **Planning Module**:
   - `Planning`

**Soft Delete Indexes**:
- Filtered indexes: `WHERE deletedAt IS NULL`
- Query patterns always filter: `deletedAt = NULL`

---

### F. Audit Trail Implementation

**Audit Tables**:

1. **`SystemLog`** - Global audit log
   - Fields: type, action, subject, userId, actorType/actorId
   - Covers all major entities

2. **`AttendanceEvaluationAudit`** - Attendance corrections
   - Tracks: previousSnapshot, nextSnapshot, reason, actor

3. **`SalaryRevision`** - Salary changes
   - Tracks: field, oldValue, newValue, reason

4. **`PlanningAuditLog`** - Planning changes
   - Tracks: action, changes (JSON), notes

5. **`PayrollAuditLog`** - Payroll changes
   - Tracks: entityType, entityId, action, changes, reason

6. **`TaxConfigHistory`** - Tax config changes
   - Tracks: field, oldValue, newValue, changedById

**Common Audit Pattern**:
- Actor tracking: `performedBy`/`performedById`
- Timestamp: `createdAt`/`performedAt`
- Change tracking: JSON diff or old/new values
- Reason field for justification

---


## II. RADIUS DATABASE (7 Tables)

**Purpose**: FreeRADIUS integration untuk PPPoE authentication & accounting.

### Tables:

1. **`radacct`** - Accounting records (session logs)
   - PK: `radacctid` (BigInt, autoincrement)
   - UK: `acctuniqueid`
   - Fields: Session times, bandwidth usage, IP addresses, NAS info
   - Indexes: 10+ indexes untuk session tracking
   - Volume: High-write, grows continuously

2. **`radcheck`** - User authentication attributes
   - PK: `id` (autoincrement)
   - UK: `username + attribute + tenantId`
   - Example: Username="customer1", Attribute="Cleartext-Password", Value="secret"

3. **`radreply`** - User reply attributes
   - PK: `id` (autoincrement)
   - UK: `username + attribute + tenantId`
   - Example: IP address assignment, bandwidth limits

4. **`radgroupcheck`** - Group check attributes
5. **`radgroupreply`** - Group reply attributes
6. **`radusergroup`** - User-to-group mapping
7. **`radpostauth`** - Post-authentication log
8. **`nas`** - Network Access Server definitions
9. **`radippool`** - IP address pool management

**Multi-Tenancy**: All tables have `tenantId` field.

---

## III. BILLING DATABASE (11 Tables)

**Purpose**: Invoice & payment processing isolation.

### Key Tables:

1. **`Invoice`** & **`InvoiceItem`** - Invoice generation
2. **`Payment`** - Payment records with gateway integration
3. **`PaymentGatewayConfig`** - Multi-gateway support
4. **`BillingSchedule`** - Scheduled jobs (overdue, auto-isolir)
5. **`UnmatchedMutation`** - Bank mutation matching
6. **`WebhookEvent`** - Payment gateway webhooks (idempotency)

---

## IV. MITRA DATABASE (8 Tables)

**Purpose**: Partner/technician management & commission wallet.

### Key Tables:

1. **`Mitra`** - Partner master with commission rates
2. **`MitraWallet`** - Digital wallet
3. **`MitraTransaction`** - Wallet transactions
4. **`WithdrawRequest`** - Withdrawal workflow
5. **`FaceVerificationLog`** - Security verification

---

## V. ENTITY RELATIONSHIP DIAGRAM (Core)

```
Tenant (Root)
├─→ User (Employee/Admin)
│   ├─→ Attendance → AttendanceEvaluation
│   ├─→ Overtime, LeaveRequest
│   ├─→ PayrollEntry → PayrollLine
│   └─→ WorkOrders
│
├─→ Sites (Locations)
│   ├─→ Gudang (Warehouses) → BarangGudang → Barang
│   ├─→ MikroTikRouter, AccelPppServer
│   └─→ Otb/Odc/Odp (Fiber Infrastructure)
│
├─→ Pelanggan (Customers)
│   ├─→ HargaPaket → Bandwidth + ProfilePPP
│   ├─→ Invoice (Billing DB) → Payment
│   ├─→ SupportTickets → WorkOrders
│   ├─→ Odp (fiber)
│   └─→ CustomerUsage
│
├─→ RabProject (Budget) → RabItem, RabInvestor
├─→ Planning (OSP) → PlanningItem, PlanningMilestone
├─→ Accounting: ChartOfAccount, JournalEntry, JournalLine
├─→ Tax: TaxTransaction, TaxPeriodSummary
└─→ Inventory: PurchaseRequest → PurchaseOrder → GoodsReceipt
```

---

## VI. CRITICAL DATA FLOWS

### A. Customer Onboarding
```
Registrations → Canvasing → WorkOrder (INSTALLATION) 
  → Pelanggan → radcheck/radreply → ProfilePPP → AKTIF
```

### B. Billing Cycle
```
BillingSchedule → Invoice → Payment → JournalEntry 
  → TaxTransaction → Invoice.PAID → MRRMovement
```

### C. Attendance → Payroll
```
Attendance → AttendanceEvaluation (daily SOT) → PayrollRun 
  → PayrollEntry calculation → PayrollLine → PAID → JournalEntry
```

---

## VII. SCHEMA PATTERNS

### Multi-Tenancy Pattern:
```prisma
tenantId String?
tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Restrict)
@@index([tenantId])
@@unique([tenantId, code]) // Composite UK
```

### Actor Polymorphism:
```prisma
userId String?        // For User actors
actorType String?     // "MITRA", "PELANGGAN", "SYSTEM"
actorId String?       // ID from respective table
@@index([actorType, actorId])
```

### Audit Trail:
```prisma
createdById String?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
deletedAt DateTime? // Soft delete
```

---

## VIII. PERFORMANCE NOTES

### High-Volume Tables (needs optimization):
1. `radacct` - Session logs (partition by month)
2. `CustomerUsage` - Usage logs (TimescaleDB candidate)
3. `Attendance` - Daily records (11 indexes)
4. `SystemLog` - Audit trail (archival needed)
5. `OutboxEvent` - Event bus (cleanup COMPLETED)
6. `NetworkPerformance` - Metrics (time-series DB)

### Critical Query Paths:
- RADIUS auth: `radcheck` lookup (every PPPoE login)
- Customer portal: Invoice, Usage queries
- Admin dashboard: Count aggregates by status
- Payroll: AttendanceEvaluation range queries

---

## IX. RECOMMENDATIONS

### Short-Term (1-3 months):
1. Add retention policies (SystemLog, radacct, OutboxEvent)
2. Column encryption for credentials & financial data
3. Index optimization (covering indexes)
4. Query performance monitoring

### Medium-Term (3-6 months):
1. TimescaleDB for time-series data
2. Event bus enhancement (LISTEN/NOTIFY)
3. Data archival pipeline
4. Read replica setup

### Long-Term (6-12 months):
1. Multi-database sharding by tenant
2. CQRS for read models
3. Microservices extraction (Billing, Payroll, Inventory)
4. GraphQL federation

---

## X. CONCLUSION

**NetManager** adalah comprehensive ISP management system dengan:

- **244 total tables** across 4 databases
- **Multi-tenant SaaS** architecture
- **Full ERP features**: HR, payroll, accounting, inventory
- **ISP-specific**: RADIUS, network provisioning
- **Partner ecosystem**: Reseller & mitra commissions

**Strengths**:
✅ Well-structured multi-tenancy
✅ Comprehensive audit trails
✅ Event-driven architecture
✅ Separate databases for scalability

**Areas for Improvement**:
⚠️ Single main DB with 218 tables (consider splitting)
⚠️ Time-series data needs dedicated solution
⚠️ Missing data retention policies
⚠️ No column-level encryption for sensitive data

**Overall**: Mature, production-ready schema dengan clear evolution path menuju distributed architecture.

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-09  
**Total Tables**: 244 (Main: 218, Billing: 11, Radius: 9, Mitra: 8)  
**Total Migrations**: 84  
**Analyst**: Claude (Kiro AI Agent)
