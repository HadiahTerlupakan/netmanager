# Modular Monolith Refactoring Tracker

Dokumen ini merupakan **Source of Truth** untuk melacak progress *refactoring* seluruh layer service aplikasi RADPRO NetManager agar secara penuh mengimplementasikan arsitektur Modular Monolith yang ketat.
Konsep utama: **Services** memproses *Business Logic*, dan HANYA **Repositories** atau **Factories** yang boleh melakukan operasi *database* via ORM (Prisma). Dilarang melakukan \`import { prisma }\` di layer \`services\`.

## Ringkasan Audit (Terakhir diperbarui: 2026-04-04)

| Status | Jumlah | Detail |
|--------|--------|--------|
| ✅ Sudah direfaktor | 38 | **TIDAK ADA** import prisma di layer services |
| ❌ Belum direfaktor | 0 | Semua service sudah bersih |
| 📊 Total | 38 | Seluruh service layer |

> **Catatan**: `import { prisma }` sekarang HANYA ada di layer `repositories/` dan `factories/` — sesuai dengan arsitektur Modular Monolith yang ketat.

## Tracker Progress (Beri tanda [x] jika sudah direfaktor)

### ✅ Phase 0: Proof of Concept (SELESAI)
- [x] \`modules/attendance/services/LocationTrackingService.ts\` — ✅ Sudah menggunakan repositories
- [x] \`modules/pelanggan/services/PelangganService.ts\` — ✅ Sudah menggunakan PelangganRepository
- [x] \`modules/pelanggan/services/CustomerAuthService.ts\` — ✅ Sudah menggunakan PelangganRepository
- [x] \`modules/pelanggan/services/AdminSupportTicketService.ts\` — ✅ Sudah menggunakan CustomerTicketRepository

---
### ✅ Phase 1: Modul Pelanggan & Registrasi (SELESAI)
- [x] ~~`modules/registration/services/RegistrationService.ts`~~ — ✅ Sudah direfaktor (menggunakan RegistrationRepository.getSettingValue)

---
### ✅ Phase 2: Modul Attendance (Menyeluruh) & Overtime (SELESAI)
- [x] ~~`modules/attendance/services/AttendanceService.ts`~~ — ✅ Sudah menggunakan AttendanceRepository + UserRepository
- [x] ~~`modules/attendance/services/AttendanceTimezoneService.ts`~~ — ✅ Sudah menggunakan SettingsRepository
- [x] ~~`modules/attendance/services/LeaveService.ts`~~ — ✅ Sudah menggunakan LeaveRepository + AttendanceRepository + UserRepository
- [x] ~~`modules/attendance/services/GeofenceService.ts`~~ — ✅ Sudah menggunakan UserRepository (findUserWithSites, getGeofencePolicy)
- [x] ~~`modules/attendance/services/AttendanceValidationService.ts`~~ — ✅ Sudah menggunakan LeaveRepository + UserRepository + HolidayRepository
- [x] ~~`modules/attendance/services/AutoCheckoutService.ts`~~ — ✅ Sudah menggunakan AttendanceRepository (findAllOpenSessionsWithUser, update)
- [x] ~~`modules/attendance/services/AbsenceService.ts`~~ — ✅ Sudah menggunakan AttendanceRepository + UserRepository + LeaveRepository
- [x] ~~`modules/attendance/services/AttendanceAlertService.ts`~~ — ✅ Sudah menggunakan AttendanceRepository + UserRepository + LeaveRepository + HolidayRepository
- [x] ~~`modules/overtime/services/OvertimeService.ts`~~ — ✅ Sudah menggunakan OvertimeRepository + UserRepository + AttendanceRepository

---
### ✅ Phase 3: Modul Operational & Finance (SELESAI)
- [x] ~~`modules/finance/services/FinanceService.ts`~~ — ✅ Sudah menggunakan 9 repositories (FinancialAccount, Expense, ExpenseCategory, RabProject, RabWbs, RabItem, RabDisbursement, RabInvestor, PurchaseOrder)
- [x] ~~`modules/finance/services/FinanceStatsService.ts`~~ — ✅ Sudah menggunakan PaymentRepository + ExpenseRepository
- [x] ~~`modules/finance/services/VoidInvoiceService.ts`~~ — ✅ Sudah menggunakan InvoiceRepository + PelangganRepository
- [x] ~~`modules/finance/services/AutomaticIsolationService.ts`~~ — ✅ Sudah menggunakan SettingsRepository + PelangganRepository + InvoiceRepository
- [x] ~~`modules/finance/services/AutomaticBillingService.ts`~~ — ✅ Sudah menggunakan SettingsRepository + PelangganRepository + InvoiceRepository + PaymentRepository
- [x] ~~`modules/finance/services/payment-gateway/gateway-manager.ts`~~ — ✅ Sudah menggunakan PaymentGatewayConfigRepository
- [x] ~~`modules/inventory/services/AssetService.ts`~~ — ✅ Sudah menggunakan ExpenseCategoryRepository + ExpenseRepository
- [x] ~~`modules/mitra/services/MitraWithdrawService.ts`~~ — ✅ Sudah menggunakan MitraWithdrawRepository + SettingsRepository
- [x] ~~`modules/salary/services/SalaryCalculatorService.ts`~~ — ✅ Sudah menggunakan UserRepository + EmployeeLoanRepository + Attendance/Overtime/WorkOrder/SalaryDetail repositories

---
### ✅ Phase 4: Modul Network & MikroTik (SELESAI)
- [x] ~~`modules/network/services/mikrotik-ping-check.ts`~~ — ✅ Sudah menggunakan NetworkRepository
- [x] ~~`modules/network/services/mikrotik-ppp-profile.ts`~~ — ✅ Sudah menggunakan NetworkRepository
- [x] ~~`modules/network/services/RadiusMonitor.ts`~~ — ✅ Sudah menggunakan NetworkRepository
- [x] ~~`modules/network/services/MikroTikPPPSecretService.ts`~~ — ✅ Sudah menggunakan NetworkRepository
- [x] ~~`modules/network/services/radius-sync-service.ts`~~ — ✅ Sudah menggunakan NetworkRepository (prismaRadius tetap sebagai radius DB client di repository layer)
- [x] ~~`modules/network/services/MikroTikMonitor.ts`~~ — ✅ Sudah menggunakan NetworkRepository

---
### ✅ Phase 5: Notification, Admin, Marketing & Lain-lain (SELESAI)
- [x] ~~`modules/admin/services/DashboardService.ts`~~ — ✅ Sudah menggunakan UserRepository
- [x] ~~`modules/roles/services/RoleService.ts`~~ — ✅ Sudah menggunakan PermissionRepository
- [x] ~~`modules/roles/services/DepartmentService.ts`~~ — ✅ Sudah menggunakan DepartmentRepository
- [x] ~~`modules/marketing/services/CanvasingAccessService.ts`~~ — ✅ Sudah direfaktor
- [x] ~~`modules/work-order/services/WorkOrderService.ts`~~ — ✅ Sudah menggunakan UserRepository + WarrantyCheckRepository + TicketRepository + WorkOrderTemplateRepository + WorkOrderMaterialRepository
- [x] ~~`modules/work-order/services/WorkOrderNotifications.ts`~~ — ✅ Sudah menggunakan CanvasingRepository + UserRepository
- [x] ~~`modules/notification/services/PushNotificationService.ts`~~ — ✅ Sudah menggunakan PushSubscriptionRepository
- [x] ~~`modules/notification/services/NotificationService.ts`~~ — ✅ Sudah menggunakan NotificationRepository + PushSubscriptionRepository + UserRepository
- [x] ~~`modules/notification/services/email-service.ts`~~ — ✅ Sudah menggunakan dependency injection pattern
- [x] ~~`modules/notification/services/ExpoPushService.ts`~~ — ✅ Sudah menggunakan UserRepository + PelangganRepository + MitraRepository
- [x] ~~`modules/notification/services/whatsapp/whatsapp-service.ts`~~ — ✅ Sudah menggunakan dependency injection pattern

---
### ✅ Bonus: Services Tambahan (SELESAI)
- [x] ~~`modules/work-order/services/WorkOrderSyncService.ts`~~ — ✅ Sudah menggunakan WorkOrderRepository + TicketRepository
- [x] ~~`modules/procurement/services/ProcurementService.ts`~~ — ✅ Sudah menggunakan ProcurementRepository (baru)
- [x] ~~`modules/integrations/services/MixRadiusSyncService.ts`~~ — ✅ Sudah menggunakan MixRadiusRepository (baru)

---

## Repository yang Sudah Tersedia (Siap Digunakan)

### Baru Dibuat Selama Refactoring Ini:
- `SettingsRepository.ts` (Attendance) — findByKey
- `NetworkRepository.ts` (Network) — Centralized tenant, router, settings, bandwidth, profile PPP, pelanggan queries
- `InvoiceRepository.ts` (Finance) — Invoice CRUD, void operations
- `PaymentRepository.ts` (Finance) — Payment queries & creation
- `PaymentGatewayConfigRepository.ts` (Finance) — Gateway config lookups
- `MitraWithdrawRepository.ts` (Mitra) — All mitra withdraw DB operations
- `SalaryCalculationRepositories.ts` (Salary) — User, EmployeeLoan, Attendance, Overtime, WorkOrder, SalaryDetail
- `PermissionRepository.ts` (Roles) — Permission CRUD
- `DepartmentRepository.ts` (Roles) — Department CRUD
- `PushSubscriptionRepository.ts` (Notification) — Push subscription operations
- `PushTokenRepository.ts` (Notification) — Push token operations
- `WorkOrderSupportRepositories.ts` (Work Order) — Ticket, template, warranty check
- `WorkOrderMaterialRepository.ts` (Work Order) — Material usage with stock deduction
- `ProcurementRepository.ts` (Procurement) — PO generation, PR queries
- `MixRadiusRepository.ts` (Integrations) — MixRadius customer, invoice, owner group operations

Berikut adalah repository files yang sudah ada dan bisa digunakan untuk refactoring:

### Attendance Module
- `AttendanceRepository.ts` (extended: create, update, deleteMany, findAllOpenSessionsWithUser, findFirstByUserAndDateRange, findCheckedInUserIds, findIncompleteCheckOutWithUser, findActiveFlexibleSessionsWithUser, createWithId, countByUserId, findFirstOpenSession, findManyStaleSessions, findFirstActiveForCheckout, findFirstForCurrentStatus, findManyForHistory, findManyForAnalytics, findManyWithUserConfig)
- `LocationTrackingRepository.ts`
- `LeaveRepository.ts` (extended: findActiveLeaveForUserOnDate)
- `LeaveBalanceRepository.ts`
- `HolidayRepository.ts`
- `SettingsRepository.ts` (BARU — findByKey)
- `SettingsRepository.ts` (BARU — findByKey)

### Pelanggan Module
- `PelangganRepository.ts`
- `CustomerTicketRepository.ts`
- `CustomerUsageRepository.ts`
- `CustomerInvoiceRepository.ts`

### Network Module
- `RadiusRepository.ts`
- `MikroTikRouterRepository.ts`
- `HargaPaketRepository.ts`
- `OdcRepository.ts`, `OdpRepository.ts`, `OtbRepository.ts`
- `PoleRepository.ts`, `JoinboxRepository.ts`, `KmzRepository.ts`
- `NetworkPerformanceRepository.ts`

### Finance Module
- `PemasukanRepository.ts`
- `PengeluaranRepository.ts`
- `BillingAnalyticsRepository.ts`

### Work Order Module
- `WorkOrderRepository.ts`

### Registration Module
- `RegistrationRepository.ts`

### Inventory Module
- `AssetRepository.ts`
- `InventoryRepository.ts`

### Salary Module
- `SalaryRepository.ts`
- `SalaryComponentRepository.ts`

### Notification Module
- `NotificationRepository.ts`

### Roles Module
- `RoleRepository.ts`
- `SiteRepository.ts`

### Marketing Module
- `CanvasingRepository.ts`
- `PointClaimRepository.ts`

### Overtime Module
- `OvertimeRepository.ts`

### Users Module
- `UserRepository.ts` (extended: findUserWithSites, findWorkScheduleById, getGeofencePolicy, findAttendanceSettingsById, findManyWithWorkConfig, findManyWithBasicInfo, findManyWithFullDetails, findWithSitesById, findByIdWithSite, findAdminsForNotification, findActiveForAttendance, findActiveWithPushTokenAndSchedule, findFixedHourUsersForAutoAlpha) (extended: findUserWithSites, findWorkScheduleById, getGeofencePolicy, findAttendanceSettingsById, findManyWithWorkConfig, findManyWithBasicInfo, findManyWithFullDetails, findWithSitesById, findByIdWithSite, findAdminsForNotification, findActiveForAttendance, findActiveWithPushTokenAndSchedule, findFixedHourUsersForAutoAlpha)

### Mitra Module
- `MitraRepository.ts`

---

## Pola Refactoring yang Benar

### ❌ SALAH (Service mengakses Prisma langsung)
```typescript
import { prisma } from '@/lib/prisma'

export class MyService {
    async getData() {
        return prisma.myModel.findMany()
    }
}
```

### ✅ BENAR (Service menggunakan Repository)
```typescript
import { MyRepository } from '../repositories/MyRepository'

export class MyService {
    private repo: MyRepository

    constructor() {
        this.repo = new MyRepository()
    }

    async getData() {
        return this.repo.findAll()
    }
}
```

---

## Langkah Refactoring untuk Setiap File

1. **Identifikasi** semua query Prisma di service
2. **Buat/Update Repository** untuk menampung query tersebut
3. **Ganti** semua `prisma.xxx` calls dengan method repository
4. **Hapus** `import { prisma }` dari service
5. **Test** untuk memastikan fungsionalitas tetap berjalan
6. **Commit** dengan pesan yang jelas

## Catatan Progress Terbaru

### ✅ Phase 3 COMPLETED (2026-04-04) — 9 services direfaktor

**Repository baru yang dibuat:**
- `InvoiceRepository.ts` (Finance) — Invoice CRUD, void operations
- `PaymentRepository.ts` (Finance) — Payment queries & creation
- `PaymentGatewayConfigRepository.ts` (Finance) — Gateway config lookups
- `MitraWithdrawRepository.ts` (Mitra) — All mitra withdraw DB operations
- `SalaryCalculationRepositories.ts` (Salary) — User, EmployeeLoan, Attendance, Overtime, WorkOrder, SalaryDetail repos

**Services refactored:**
1. **FinanceService.ts** — 10 methods → 9 repositories (FinancialAccount, Expense, ExpenseCategory, RabProject, RabWbs, RabItem, RabDisbursement, RabInvestor, PurchaseOrder)
2. **FinanceStatsService.ts** — `prismaBilling.payment` → PaymentRepository, `prisma.expense` → ExpenseRepository
3. **VoidInvoiceService.ts** — `prismaBilling.invoice` → InvoiceRepository, `prisma.pelanggan` → PelangganRepository
4. **AutomaticIsolationService.ts** — `prisma.settings` → SettingsRepository, `prisma.pelanggan` → PelangganRepository
5. **AutomaticBillingService.ts** — `prisma.settings` → SettingsRepository, `prisma.pelanggan` → PelangganRepository
6. **gateway-manager.ts** — `prismaBilling.paymentGatewayConfig` → PaymentGatewayConfigRepository
7. **AssetService.ts** — `prisma.expenseCategory/expense` → ExpenseCategoryRepository + ExpenseRepository
8. **MitraWithdrawService.ts** — `prisma.settings` → SettingsRepository, `prismaMitra.*` → MitraWithdrawRepository
9. **SalaryCalculatorService.ts** — `prisma.user/employeeLoan/attendance/overtime/workOrders/salaryDetail` → 6 specialized repositories

### ✅ Phase 4 COMPLETED (2026-04-04) — 6 services direfaktor

**Repository baru:**
- `NetworkRepository.ts` (Network) — Centralized repository untuk tenant lookups, router tenant IDs, settings, bandwidth, profile PPP, dan pelanggan queries

**Services refactored:**
1. **mikrotik-ping-check.ts** — `prisma.tenant/mikroTikRouter` → NetworkRepository
2. **mikrotik-ppp-profile.ts** — `prisma.mikroTikRouter/bandwidth/profilePPP` → NetworkRepository
3. **RadiusMonitor.ts** — `prisma.tenant` → NetworkRepository
4. **MikroTikPPPSecretService.ts** — `prisma.pelanggan/mikroTikRouter` → NetworkRepository
5. **radius-sync-service.ts** — `prisma.settings/pelanggan` → NetworkRepository
6. **MikroTikMonitor.ts** — `prisma.tenant` → NetworkRepository

### ✅ Phase 5 COMPLETED (2026-04-04) — 10 services direfaktor

**Repository baru:**
- `PermissionRepository.ts` (Roles) — Permission CRUD operations
- `DepartmentRepository.ts` (Roles) — Department CRUD operations
- `PushSubscriptionRepository.ts` (Notification) — Push subscription operations
- `PushTokenRepository.ts` (Notification) — Push token operations across user/mitra/pelanggan tables
- `WorkOrderSupportRepositories.ts` (Work Order) — Ticket, template, dan warranty check operations
- `WorkOrderMaterialRepository.ts` (Work Order) — Material usage with stock deduction transaction

**Services refactored:**
1. **DashboardService.ts** — Sudah menggunakan UserRepository
2. **RoleService.ts** — Sudah menggunakan PermissionRepository
3. **DepartmentService.ts** — Sudah menggunakan DepartmentRepository
4. **WorkOrderService.ts** — `prisma.user/workOrders` → UserRepository + WarrantyCheckRepository + TicketRepository + WorkOrderTemplateRepository + WorkOrderMaterialRepository
5. **WorkOrderNotifications.ts** — Sudah menggunakan CanvasingRepository + UserRepository
6. **PushNotificationService.ts** — Sudah menggunakan PushSubscriptionRepository
7. **NotificationService.ts** — Sudah menggunakan NotificationRepository + PushSubscriptionRepository + UserRepository
8. **email-service.ts** — Sudah menggunakan dependency injection pattern
9. **ExpoPushService.ts** — Sudah menggunakan UserRepository + PelangganRepository + MitraRepository
10. **whatsapp-service.ts** — Sudah menggunakan dependency injection pattern

### ✅ Phase 2 COMPLETED (2026-04-04) — 9 services direfaktor

**Repository methods baru yang ditambahkan:**

| Repository | Methods Baru |
|------------|-------------|
| `AttendanceRepository` | `findAllOpenSessionsWithUser`, `update`, `create`, `findFirstByUserAndDateRange`, `findCheckedInUserIds`, `findIncompleteCheckOutWithUser`, `findIncompleteCheckOutSelect`, `findActiveFlexibleSessionsWithUser`, `createWithId`, `countByUserId`, `findFirstOpenSession`, `findManyStaleSessions`, `findFirstActiveForCheckout`, `findFirstForCurrentStatus`, `findManyForHistory`, `findManyForAnalytics`, `findFirstWithUser` |
| `LeaveRepository` | `findActiveLeaveForUserOnDate` |
| `SettingsRepository` | `findByKey` (file BARU) |
| `UserRepository` | `findUserWithSites`, `findWorkScheduleById`, `getGeofencePolicy`, `findAttendanceSettingsById`, `findManyWithWorkConfig`, `findManyWithBasicInfo`, `findManyWithFullDetails`, `findWithSitesById`, `findByIdWithSite`, `findAdminsForNotification`, `findActiveForAttendance`, `findActiveWithPushTokenAndSchedule`, `findFixedHourUsersForAutoAlpha` |

**Detail per service yang direfaktor:**

1. **AutoCheckoutService.ts** — `prisma.attendance.findMany` → `AttendanceRepository.findAllOpenSessionsWithUser()`, `prisma.attendance.update` → `AttendanceRepository.update()`
2. **AttendanceTimezoneService.ts** — `prisma.settings.findFirst` ×2 → `SettingsRepository.findByKey()`
3. **AttendanceValidationService.ts** — `prisma.leaveRequest.findFirst` → `LeaveRepository.findActiveLeaveForUserOnDate()`, `prisma.user.findUnique` → `UserRepository.findWorkScheduleById()`
4. **GeofenceService.ts** — `prisma.user.findUnique` ×2 → `UserRepository.findUserWithSites()`, `prisma.$queryRaw` → `UserRepository.getGeofencePolicy()`
5. **OvertimeService.ts** — `prisma.overtime.findFirst` → `OvertimeRepository.findActiveRequestByDate()`, `prisma.user.findFirst/Many` → `UserRepository.findByIdWithSite()/findAdminsForNotification()`, `prisma.attendance.findFirst` → `AttendanceRepository.findFirstWithUser()`
6. **AbsenceService.ts** — `prisma.user.findMany` → `UserRepository.findActiveForAttendance()`, `prisma.attendance.findFirst/create` → `AttendanceRepository.findFirstByUserAndDateRange()/create()`, `prisma.leaveRequest.findFirst` → `LeaveRepository.findActiveLeaveForUserOnDate()`
7. **AttendanceAlertService.ts** — 9 prisma calls → `UserRepository`, `AttendanceRepository`, `LeaveRepository`, `HolidayRepository` methods
8. **LeaveService.ts** — Sudah menggunakan repositories (tidak ada `import { prisma }`)
9. **AttendanceService.ts** — 15 prisma/prismaAuth calls → `AttendanceRepository` + `UserRepository` methods

### ✅ Phase 1 COMPLETED (2026-04-03)
- `RegistrationService.ts` — Direfaktor: hapus `import { prisma }`, tambahkan `getSettingValue()` ke RegistrationRepository

---
> Saat melakukan *pair programming* dengan AI, selalu referensi dokumen ini untuk mendata progres mana yang paling anyar. Jangan pernah menghapus fase tanpa menyelesaikan eksekusinya.
