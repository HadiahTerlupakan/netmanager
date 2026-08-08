# Module Overview — Domain Modules

**Last Updated:** 2026-08-09  
**Total Modules:** 38

---

## Module Status Legend

- ✅ **Clean Architecture** — Fully migrated (domain/entities, domain/ports, mappers)
- ⚙️ **In Migration** — Partially migrated, mixed patterns
- ⚠️ **Legacy** — Old pattern, needs migration
- 🆕 **New** — Recently added, follows new standards

---

## Core Business Modules

### 1. Pelanggan (Customer Management) ✅

**Status:** Clean Architecture (NEW pattern)  
**Complexity:** High  
**Business Criticality:** CRITICAL

**Structure:**
```
modules/pelanggan/
├── domain/
│   ├── entities/PelangganEntity.ts
│   └── ports/IPelangganRepository.ts
├── dto/PelangganDTO.ts
├── repositories/PelangganRepository.ts
├── mappers/PelangganMapper.ts
├── services/PelangganService.ts
├── types/pelanggan.enums.ts
├── utils/
└── validators/
```

**Purpose:**
- Customer registration & lifecycle management
- PPPoE credential management
- Package assignment & billing configuration
- Status transitions (AKTIF, NONAKTIF, ISOLIR, DISMANTLE)
- Integration with network provisioning

**Key Files:**
- `PelangganService.ts` — Main business logic
- `PelangganRepository.ts` — Data access with tenant isolation
- `PelangganDTO.ts` — API contracts

**Dependencies:**
- `finance` — Invoice generation
- `network` — MikroTik provisioning
- `olt` — ONU provisioning (if fiber)
- `events` — Customer lifecycle events

**Database Tables:**
- `Pelanggan` (main)
- `Registrations` (leads/prospects)
- Related: Invoice, Payment, WorkOrder, SupportTicket

---

### 2. Finance (Billing & Payments) ⚠️

**Status:** Legacy (needs migration)  
**Complexity:** Very High  
**Business Criticality:** CRITICAL

**Structure:**
```
modules/finance/
├── dto/
├── repositories/
├── services/
│   ├── BillingInvoiceCreationService.ts
│   ├── InvoiceOverdueExecutionService.ts
│   ├── InvoiceProrateService.ts
│   ├── PaymentRouteService.ts
│   └── [10+ other services]
└── validators/
```

**Purpose:**
- Invoice generation (recurring & one-time)
- Payment processing (multiple gateways)
- Proration calculations
- Overdue management & auto-isolir
- Revenue recognition
- AR aging reports

**Key Services:**
- `BillingInvoiceCreationService` — Invoice generation
- `PaymentRouteService` — Payment processing
- `InvoiceProrateService` — Proration logic
- `InvoiceOverdueExecutionService` — Overdue handling

**Dependencies:**
- `pelanggan` — Customer data
- `accounting` — Journal entry generation
- `payment-gateway` — Payment provider integration
- `notification` — Payment receipts

**Database Tables:**
- `Invoice`, `InvoiceItem` (billing DB)
- `Payment` (billing DB)
- `ARAgingSnapshot`, `RevenueSnapshot`

---

### 3. Accounting (Double-Entry GL) ✅

**Status:** Clean Architecture (NEW pattern)  
**Complexity:** High  
**Business Criticality:** HIGH

**Structure:**
```
modules/accounting/
├── domain/
│   ├── entities/
│   └── ports/
├── dto/
├── repositories/
├── services/
│   ├── ChartOfAccountService.ts
│   ├── JournalPostingService.ts
│   ├── PeriodService.ts
│   ├── RecurringEngineService.ts
│   └── BankReconciliationService.ts
└── validators/
```

**Purpose:**
- Chart of Accounts (COA) management
- Journal entry posting (double-entry)
- Period management (open/close)
- Bank reconciliation
- Financial reports (Trial Balance, Neraca, Laba-Rugi)
- Recurring journal templates

**Key Services:**
- `JournalPostingService` — Create balanced journal entries
- `PeriodService` — Fiscal period management
- `RecurringEngineService` — Automated journal generation
- `BankReconciliationService` — Bank statement matching

**Dependencies:**
- `finance` — Automatic journal from invoices/payments
- Events from other modules trigger auto-journals

**Database Tables:**
- `ChartOfAccount`, `AccountingPeriod`
- `JournalEntry`, `JournalLine`
- `RecurringJournalTemplate`
- `BankReconciliation`, `BankReconciliationLine`

---

### 4. Network (MikroTik Integration) ⚠️

**Status:** Legacy  
**Complexity:** High  
**Business Criticality:** CRITICAL

**Purpose:**
- MikroTik RouterOS API integration
- PPP secret provisioning
- Bandwidth profile management
- IP pool allocation
- RADIUS sync
- Real-time monitoring

**Key Files:**
- `mikrotik-provisioning.proxy.ts`
- `mikrotik-ppp-secret.connection.ts`
- `mikrotik-ip-pool-client.ts`

**External Dependency:**
- `node-routeros-v2` library
- MikroTik RouterOS API

**Integration Points:**
- Triggered by customer status changes
- Event-driven provisioning
- Retry logic for failures

---

### 5. OLT (Fiber Equipment Management) ⚠️

**Status:** Legacy  
**Complexity:** Very High  
**Business Criticality:** HIGH

**Purpose:**
- OLT/ONU provisioning
- SNMP monitoring
- Telnet/SSH CLI commands
- Bulk operations
- Power level monitoring
- Firmware upgrades

**Key Services:**
- `OltDeviceService` — Device management
- `OltOnuService` — ONU lifecycle
- `OltProvisioningService` — Provisioning orchestration
- `OnuDiscoveryService` — Auto-discovery
- `BulkOperationService` — Batch operations

**External Dependencies:**
- `net-snmp` — SNMP protocol
- `node-ssh` — SSH for CLI
- `telnet-client` — Telnet for legacy devices

**Complexity Factors:**
- Multi-vendor support (ZTE, Huawei, Fiberhome)
- Different OIDs per vendor
- CLI syntax variations

---

### 6. Attendance (HR - Check-in/out) ⚠️

**Status:** Legacy  
**Complexity:** Medium  
**Business Criticality:** HIGH

**Purpose:**
- Employee check-in/check-out
- Geofencing validation
- Attendance evaluation (SOT)
- Correction mechanism
- Overtime tracking integration

**Key Tables:**
- `Attendance` — Raw check-in/out records
- `AttendanceEvaluation` — Single source of truth for payroll
- `AttendanceEvaluationAudit` — Change tracking

**Business Rules:**
- Geofence validation with distance calculation
- Late detection based on shift schedule
- No duplicate check-in on same day
- Correction workflow with evidence

---

### 7. Work Order (Field Operations) ⚠️

**Status:** Legacy  
**Complexity:** High  
**Business Criticality:** HIGH

**Purpose:**
- Installation work orders
- Maintenance scheduling
- Troubleshooting tickets
- Technician assignment
- Status workflow
- Photo documentation

**Key Tables:**
- `WorkOrders` — Main work order
- `WorkOrderPartnerAssignments` — Technician assignment
- `WorkOrderStatusHistories` — Status audit trail

**Workflow:**
```
OPEN → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED
     ↓
  CANCELLED (any time)
```

---

### 8. Inventory (Stock Management) ⚠️

**Status:** Legacy  
**Complexity:** High  
**Business Criticality:** HIGH

**Purpose:**
- Multi-warehouse inventory
- Stock movements (in, out, transfer)
- Restock management
- Stock opname (audit)
- Integration with work orders
- Minimum stock alerts

**Key Tables:**
- `Barang` (Items), `Gudang` (Warehouses)
- `StockMovement`, `StockIn`, `StockOut`
- `StockTransfer`, `StockOpname`

**Actor Pattern:**
- `actorType` + `actorId` for polymorphic actors
- Supports: User, Pelanggan, Mitra, System

---

### 9. Procurement (Purchase Management) ⚠️

**Status:** Legacy  
**Complexity:** Medium  
**Business Criticality:** MEDIUM

**Purpose:**
- Purchase Request (PR)
- Purchase Order (PO) 
- Good Receipt Note (GRN)
- Return to Vendor (RTV)
- Vendor management
- Integration with inventory

**Workflow:**
```
PR → PO → GRN → Stock In
     ↓
   RTV → Stock Out
```

---

## Platform Services

### 10. Roles (RBAC) ⚠️

**Purpose:** Role-Based Access Control
**Tables:** `Role`, `Permission`, `UserRole`, `RolePermission`
**Features:** Permission aliases, hierarchical roles

### 11. Users (User Management) ⚠️

**Purpose:** Employee/admin user management
**Integration:** NextAuth.js for session management
**Tables:** `User`, `Account`, `Session`

### 12. Tenant (Multi-Tenancy) ⚠️

**Purpose:** Tenant isolation root entity
**Pattern:** Row-level security via `tenantId`
**Tables:** `Tenant` (hub for 85+ relationships)

### 13. Settings (Configuration) ⚠️

**Purpose:** System-wide and tenant-specific settings
**Pattern:** Key-value store with type safety
**Tables:** `Settings`

### 14. Feature Flags ⚠️

**Purpose:** Feature toggles for gradual rollout
**Pattern:** Boolean flags with tenant scope
**Tables:** `FeatureFlag`

---

## Communication Modules

### 15. Notification (Multi-channel) ⚠️

**Channels:** Email, WhatsApp, Push (Firebase FCM)
**Pattern:** Queue-based with retry
**Tables:** `Notification`, `PushRetryQueue`

### 16. Chat (Real-time Messaging) ⚠️

**Technology:** Firebase Realtime Database
**Purpose:** Admin-customer support chat
**Pattern:** Real-time subscriptions

---

## External Integration Modules

### 17. Payment Gateway ⚠️

**Providers:** Xendit, Midtrans, Tripay, Duitku, Moota
**Pattern:** Abstract gateway interface
**Tables:** `PaymentGatewayConfig` (billing DB)

### 18. App Update (Mobile OTA) ⚠️

**Purpose:** Expo Updates OTA delivery
**Features:** APK management, version control
**Tables:** `AppRelease`, `AppReleaseAsset`

### 19. Integrations (Third-party APIs) ⚠️

**Purpose:** Generic integration framework
**Examples:** Accel-PPP, external APIs

---

## Supporting Modules

### 20. Salary (Payroll) ⚠️

**Purpose:** Salary calculation, payslip generation
**Integration:** Attendance data, deductions
**Tables:** `Payroll`, `PayrollLine`

### 21. Overtime ⚠️

**Purpose:** Overtime request & approval
**Integration:** Attendance evaluation
**Tables:** `Overtime`

### 22. Shift ⚠️

**Purpose:** Shift scheduling
**Integration:** Attendance validation
**Tables:** `Shift`, `UserShift`

### 23. Coupons ⚠️

**Purpose:** Discount management
**Tables:** `Coupon`, `CouponUsage`

### 24. Marketing ⚠️

**Purpose:** Campaign management, lead tracking
**Tables:** `Campaign`, `Lead`

### 25. Map ⚠️

**Purpose:** Geolocation services, coverage maps
**Technology:** OpenLayers, Leaflet

### 26. Investor ⚠️

**Purpose:** Profit sharing, investor portal
**Tables:** `Investor`, `InvestorDeposit`, `ProfitShare`

### 27. Mitra (Partner/Reseller) ⚠️

**Database:** Separate `mitra` database
**Purpose:** Partner wallet, commission tracking
**Tables:** `Mitra`, `MitraWallet`, `MitraWithdraw`

### 28. Tax ⚠️

**Purpose:** Tax calculation (PPN, PPh, BHP/USO)
**Tables:** `TaxConfiguration`

### 29. Website (CMS) ⚠️

**Purpose:** Landing page management
**Tables:** `Page`, `Post`

### 30. Incident ⚠️

**Purpose:** Incident tracking
**Tables:** `Incident`

---

## Infrastructure Modules

### 31. Database (Shared Utilities) ⚠️

**Purpose:** Database helper functions
**No tables** — utility module

### 32. Events (Domain Events) ⚠️

**Purpose:** Event dispatcher orchestration
**Pattern:** Publish-subscribe via EventBus
**Tables:** `OutboxEvent` (reliability pattern)

---

## New / In Development

### 33. Planning (OSP Project Planning) 🆕

**Status:** Clean Architecture (staging)  
**Purpose:** Outside Plant project planning
**Tables:** Planning, PlanningItem, PlanningMilestone
**Note:** Newly added, full implementation pending

### 34. Registration (Customer Onboarding) ⚠️

**Purpose:** Lead-to-customer conversion workflow
**Tables:** `Registrations`, `Canvasing`

### 35. Admin (Admin Utilities) ⚠️

**Purpose:** Admin-specific utilities
**Pattern:** Misc admin functions

### 36. App Version ⚠️

**Purpose:** Version management for mobile apps
**Tables:** Related to app updates

### 37. Reseller ⚠️

**Purpose:** Reseller hierarchy management
**Tables:** `Reseller`, `ResellerOutlet`
**Pattern:** Soft delete support

### 38. Overtime (Already covered above)

---

## Module Dependency Matrix

### High Coupling (Many Dependencies)
- `finance` → pelanggan, accounting, payment-gateway, notification
- `pelanggan` → finance, network, olt, work-order
- `work-order` → pelanggan, inventory, attendance

### Low Coupling (Isolated)
- `website` — Independent CMS
- `map` — Geolocation utilities
- `tax` — Pure calculation

### Cross-Cutting Concerns
- `events` — Used by all domains
- `tenant` — Used by all business modules
- `roles` — Used by all protected features
- `notification` — Used by all user-facing actions

---

## Migration Priority

### Phase 1 (Done) ✅
- `accounting`
- `pelanggan`
- `planning`

### Phase 2 (High Priority)
- `finance` — Critical for billing
- `network` — Critical for operations
- `attendance` — Critical for HR

### Phase 3 (Medium Priority)
- `work-order`
- `inventory`
- `olt`

### Phase 4 (Low Priority)
- Supporting modules
- Admin utilities
- Optional features

---

## Naming Conventions

### Service Classes
- `XxxService.ts` — Main orchestration
- `XxxService.helpers.ts` — Pure helper functions
- `XxxService.contracts.ts` — Input/output types

### Repository Classes
- `XxxRepository.ts` — Main implementation
- `IXxxRepository.ts` or `domain/ports/IXxxRepository.ts` — Interface

### DTOs
- `XxxDTO.ts` — Data transfer objects
- Separate input/output when different shapes

### Mappers
- `XxxMapper.ts` — Bidirectional transformation
- Static methods: `toDomainEntity()`, `toDTO()`, `fromDTO()`

---

**Module Documentation:** COMPLETED (High-level)  
**Deep Dive:** Each module deserves dedicated documentation  
**Total Modules:** 38 domains
