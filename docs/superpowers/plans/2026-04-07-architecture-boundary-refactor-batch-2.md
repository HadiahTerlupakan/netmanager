# Architecture Boundary Refactor Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining active `@/lib/repositories` coupling and replace direct cross-module repository access with module-level public API usage in the next highest-signal hotspots.

**Architecture:** This batch reduces coupling by deleting the shared service-locator dependency from active consumers first, then replacing repository-folder imports with owning-module service or repository exports from module roots. The changes stay narrow: no speculative abstraction, only moving existing callers onto explicit module APIs and keeping verification green.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest

---

## File map

### Shared barrel removal slice
- Modify: `lib/repositories/index.ts`
- Modify: `lib/auth.ts`
- Modify: `modules/admin/services/DashboardService.ts`
- Modify: `modules/admin/services/AdminDashboardPageService.ts`
- Modify: `modules/work-order/services/EmployeeWorkOrderQueryService.ts`
- Modify: `modules/network/services/MikroTikMonitor.ts`
- Modify: `modules/network/services/MikroTikPPPSecretService.ts`
- Modify: `modules/network/services/mikrotik-ping-check.ts`
- Modify: `modules/network/services/mikrotik-ppp-profile.ts`
- Modify: `app/api/mikrotik-routers/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/generate-api-user/route.ts`
- Modify: `app/api/mikrotik-routers/test-connection/route.ts`
- Modify: `app/api/marketing/canvasing/route.ts`
- Modify: `app/api/marketing/canvasing/[id]/route.ts`
- Modify: `app/api/marketing/canvasing/[id]/approve/route.ts`
- Modify: `app/api/marketing/canvasing/[id]/claim/route.ts`
- Modify: `app/api/marketing/point-claims/route.ts`
- Modify: `app/api/marketing/point-claims/[id]/route.ts`
- Modify: `app/api/marketing/point-claims/summary/route.ts`
- Modify: `app/api/inventory/barang/route.ts`
- Modify: `app/api/inventory/barang/[id]/route.ts`
- Modify: `app/api/inventory/gudang/route.ts`
- Modify: `app/api/inventory/gudang/[id]/route.ts`
- Modify: `app/api/inventory/keluar/route.ts`
- Modify: `app/api/inventory/masuk/route.ts`
- Modify: `app/api/inventory/transfer/route.ts`
- Modify: `app/api/inventory/transfer/[id]/route.ts`
- Modify: `app/api/mobile/auth/me/route.ts`
- Modify: `app/api/mobile/inventory/keluar/route.ts`

### Cross-module repository import slice
- Modify: `modules/attendance/services/AttendanceService.ts`
- Modify: `modules/overtime/services/OvertimeService.ts`
- Modify: `modules/salary/services/SalaryCalculatorService.ts`
- Modify module exports as needed:
  - `modules/users/index.ts`
  - `modules/work-order/index.ts`
  - `modules/network/index.ts`
  - `modules/inventory/index.ts`
  - `modules/marketing/index.ts`
  - `modules/attendance/index.ts`
  - `modules/overtime/index.ts`

### Verification slice
- Modify tests only if import surfaces require updates:
  - `tests/modules/work-order/WorkOrderService.test.ts`
  - `tests/modules/attendance/LeaveService.test.ts`
  - `tests/modules/overtime/OvertimeService.test.ts`
  - `tests/modules/pelanggan/PelangganService.test.ts`

## Task 1: Replace active `@/lib/repositories` consumers with module public APIs

**Files:**
- Modify: `lib/auth.ts`
- Modify: `modules/admin/services/DashboardService.ts`
- Modify: `modules/admin/services/AdminDashboardPageService.ts`
- Modify: `modules/work-order/services/EmployeeWorkOrderQueryService.ts`
- Modify: `modules/network/services/MikroTikMonitor.ts`
- Modify: `modules/network/services/MikroTikPPPSecretService.ts`
- Modify: `modules/network/services/mikrotik-ping-check.ts`
- Modify: `modules/network/services/mikrotik-ppp-profile.ts`
- Modify: `app/api/mikrotik-routers/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/generate-api-user/route.ts`
- Modify: `app/api/mikrotik-routers/test-connection/route.ts`
- Modify: `app/api/mobile/auth/me/route.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Replace the shared barrel imports with direct module-root imports**

```ts
// lib/auth.ts
import { UserRepository } from '@/modules/users'

// modules/admin/services/DashboardService.ts
import { AttendanceRepository } from '@/modules/attendance'
import { WorkOrderRepository } from '@/modules/work-order'
import { PointClaimRepository } from '@/modules/marketing/repositories/PointClaimRepository'
import { InventoryRepository } from '@/modules/inventory'
import { UserRepository } from '@/modules/users'

// modules/admin/services/AdminDashboardPageService.ts
import { MikroTikRouterRepository } from '@/modules/network'

// modules/work-order/services/EmployeeWorkOrderQueryService.ts
import { WorkOrderRepository } from '@/modules/work-order'
```

- [ ] **Step 2: Replace network service imports from the shared barrel**

```ts
// modules/network/services/MikroTikMonitor.ts
import { MikroTikRouterRepository } from '@/modules/network'

// modules/network/services/MikroTikPPPSecretService.ts
import { MikroTikRouterRepository } from '@/modules/network'

// modules/network/services/mikrotik-ping-check.ts
import { MikroTikRouterRepository } from '@/modules/network'

// modules/network/services/mikrotik-ppp-profile.ts
const { MikroTikRouterRepository } = await import('@/modules/network')
const routerRepo = new MikroTikRouterRepository()
```

- [ ] **Step 3: Replace route-level imports from the shared barrel**

```ts
// app/api/mikrotik-routers/**/*.ts
import { MikroTikRouterRepository } from '@/modules/network'
const routerRepository = new MikroTikRouterRepository()

// app/api/mobile/auth/me/route.ts
import { UserRepository } from '@/modules/users'
const userRepository = new UserRepository()
```

- [ ] **Step 4: Run typecheck after the import replacement**

Run: `npm run typecheck`
Expected: PASS or only marketing/inventory route import failures that will be addressed in Task 2.

## Task 2: Remove marketing and inventory route dependency on `lib/repositories`

**Files:**
- Modify: `app/api/marketing/canvasing/route.ts`
- Modify: `app/api/marketing/canvasing/[id]/route.ts`
- Modify: `app/api/marketing/canvasing/[id]/approve/route.ts`
- Modify: `app/api/marketing/canvasing/[id]/claim/route.ts`
- Modify: `app/api/marketing/point-claims/route.ts`
- Modify: `app/api/marketing/point-claims/[id]/route.ts`
- Modify: `app/api/marketing/point-claims/summary/route.ts`
- Modify: `app/api/inventory/barang/route.ts`
- Modify: `app/api/inventory/barang/[id]/route.ts`
- Modify: `app/api/inventory/gudang/route.ts`
- Modify: `app/api/inventory/gudang/[id]/route.ts`
- Modify: `app/api/inventory/keluar/route.ts`
- Modify: `app/api/inventory/masuk/route.ts`
- Modify: `app/api/inventory/transfer/route.ts`
- Modify: `app/api/inventory/transfer/[id]/route.ts`
- Modify: `app/api/mobile/inventory/keluar/route.ts`
- Test: `npm run lint -- app/api/marketing app/api/inventory app/api/mobile/inventory/keluar/route.ts`

- [ ] **Step 1: Instantiate marketing services from module exports instead of the shared barrel**

```ts
// app/api/marketing/canvasing/*.ts
import { CanvasingService } from '@/modules/marketing'
import { CanvasingRepository } from '@/modules/marketing/repositories/CanvasingRepository'
import { WorkOrderRepository } from '@/modules/work-order'
import { prisma } from '@/lib/prisma'

const service = new CanvasingService(
  new CanvasingRepository(prisma),
  new WorkOrderRepository()
)

// app/api/marketing/point-claims*.ts
import { PointClaimService } from '@/modules/marketing'
import { PointClaimRepository } from '@/modules/marketing/repositories/PointClaimRepository'
import { prisma } from '@/lib/prisma'

const service = new PointClaimService(
  new PointClaimRepository(prisma),
  prisma
)
```

- [ ] **Step 2: Instantiate inventory repositories directly from the inventory module**

```ts
// app/api/inventory/**/*.ts
import { InventoryRepository } from '@/modules/inventory'

const inventoryRepository = new InventoryRepository()
```

- [ ] **Step 3: Run lint on the touched route trees**

Run: `npm run lint -- app/api/marketing app/api/inventory app/api/mobile/inventory/keluar/route.ts`
Expected: PASS

## Task 3: Replace cross-module repository imports inside service hotspots

**Files:**
- Modify: `modules/attendance/services/AttendanceService.ts`
- Modify: `modules/overtime/services/OvertimeService.ts`
- Modify: `modules/salary/services/SalaryCalculatorService.ts`
- Test: `npm run test:run -- tests/modules/attendance/LeaveService.test.ts tests/modules/overtime/OvertimeService.test.ts tests/modules/work-order/WorkOrderService.test.ts`

- [ ] **Step 1: Replace repository-folder imports with module public API imports**

```ts
// modules/attendance/services/AttendanceService.ts
import { OvertimeRepository } from '@/modules/overtime'
import { UserRepository } from '@/modules/users'

// modules/overtime/services/OvertimeService.ts
import { HolidayRepository, AttendanceRepository } from '@/modules/attendance'
import { UserRepository } from '@/modules/users'

// modules/salary/services/SalaryCalculatorService.ts
import { AttendanceRepository, LeaveBalanceRepository } from '@/modules/attendance'
import { OvertimeRepository } from '@/modules/overtime'
```

- [ ] **Step 2: Keep constructor/runtime behavior unchanged, only swap import boundaries**

```ts
this.attendanceRepo = new AttendanceRepository()
this.overtimeRepo = new OvertimeRepository()
this.leaveBalanceRepo = new LeaveBalanceRepository()
this.userRepository = new UserRepository()
```

- [ ] **Step 3: Run focused service tests**

Run: `npm run test:run -- tests/modules/attendance/LeaveService.test.ts tests/modules/overtime/OvertimeService.test.ts tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

## Task 4: Shrink `lib/repositories/index.ts` to legacy-only surface

**Files:**
- Modify: `lib/repositories/index.ts`
- Test: `npm run lint -- lib/repositories/index.ts`

- [ ] **Step 1: Delete the helper factories that no longer have active consumers**

```ts
// remove unused exports/helpers from lib/repositories/index.ts
- getUserRepository
- getWorkOrderRepository
- getAttendanceRepository
- getInventoryRepository
- getCanvasingRepository
- getCanvasingService
- getPointClaimRepository
- getPointClaimService
- getMikroTikRouterRepository
```

- [ ] **Step 2: Keep only the minimum legacy exports still required by untouched code**

```ts
// if no active repo consumers remain, reduce file to named re-exports still needed by imports elsewhere
export { UserRepository } from './UserRepository'
export type { IUserRepository, UserCreateData, UserUpdateData, UserPublic, UserWithPassword } from './IUserRepository'
```

- [ ] **Step 3: Run lint on the shared barrel**

Run: `npm run lint -- lib/repositories/index.ts`
Expected: PASS

## Task 5: Full verification

**Files:**
- Modify any touched files required by lint/type/build follow-up

- [ ] **Step 1: Run lint for the full project**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 2: Run typecheck for the full project**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Re-run the full verification sequence**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

## Self-review
- Spec coverage check: plan covers the remaining active `lib/repositories` consumers and the audited service-level cross-module repository imports.
- Placeholder scan: no TODO/TBD placeholders remain; every task includes paths and commands.
- Type consistency check: all planned replacements use existing class names and module root exports already present in the codebase.
