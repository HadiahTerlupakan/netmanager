# Architecture Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the audited layering violations and refactor the main god files so the hotspot areas follow `UI -> API -> Service -> Repository -> Database` and pass lint, typecheck, and build cleanly.

**Architecture:** This plan uses a boundary-first refactor. First move orchestration and data access behind module-level service/query entrypoints, then split the hotspot UI files by responsibility, and finally run full-project verification. The implementation intentionally avoids broad abstraction and keeps each new entrypoint narrowly scoped to an audited use-case.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, Tailwind CSS

---

## File map

### Pelanggan PPP slice
- Modify: `app/api/pelanggan-ppp/[id]/route.ts`
- Modify: `app/admin/pelanggan/ppp/[id]/PppDetailClient.tsx`
- Modify: `app/admin/pelanggan/ppp/PppList.tsx`
- Modify: `app/admin/pelanggan/ppp/[id]/CustomerInvoiceHistory.tsx`
- Create: `app/admin/pelanggan/ppp/[id]/pppDetailQuery.ts`
- Create: `app/admin/pelanggan/ppp/pppListColumns.tsx`
- Create: `app/admin/pelanggan/ppp/pppListActions.ts`
- Create: `app/admin/pelanggan/ppp/[id]/customerInvoiceHistoryApi.ts`
- Create or modify under module public API:
  - `modules/pelanggan/services/PelangganAdminQueryService.ts`
  - `modules/pelanggan/services/PelangganAdminMutationService.ts`
  - `modules/pelanggan/index.ts`

### Dashboard and employee pages slice
- Modify: `app/admin/AdminDashboardClient.tsx`
- Modify: `app/admin/integrations/mixradius/page.tsx`
- Modify: `app/admin/finance/unpaid/page.tsx`
- Modify: `app/karyawan/work-order/page.tsx`
- Modify: `app/karyawan/izin/page.tsx`
- Modify: `app/karyawan/lembur/page.tsx`
- Create:
  - `modules/admin/services/AdminDashboardPageService.ts`
  - `modules/integrations/services/MixRadiusPageService.ts`
  - `modules/finance/services/FinancePageQueriesService.ts`
  - `modules/work-order/services/EmployeeWorkOrderQueryService.ts`
  - `modules/attendance/services/EmployeeLeaveQueryService.ts`
  - `modules/overtime/services/EmployeeOvertimeQueryService.ts`
- Modify module exports as needed:
  - `modules/admin/index.ts`
  - `modules/integrations/index.ts`
  - `modules/finance/index.ts`
  - `modules/work-order/index.ts`
  - `modules/attendance/index.ts`
  - `modules/overtime/index.ts`

### Cross-module boundary slice
- Modify: `modules/inventory/services/AssetService.ts`
- Modify: `modules/finance/services/AutomaticBillingService.ts`
- Modify: `modules/finance/services/AutomaticIsolationService.ts`
- Modify: `modules/notification/services/ExpoPushService.ts`
- Create narrowly scoped service entrypoints in owning modules as needed:
  - `modules/finance/services/FinanceExpenseBridgeService.ts`
  - `modules/pelanggan/services/PelangganBillingBridgeService.ts`
  - `modules/pelanggan/services/PelangganPushTokenService.ts`
- Modify exports:
  - `modules/finance/index.ts`
  - `modules/pelanggan/index.ts`
  - `modules/notification/index.ts`
  - `modules/inventory/index.ts`

### Verification slice
- Modify tests only if needed to reflect moved imports or new service entrypoints:
  - `tests/modules/pelanggan/PelangganService.test.ts`
  - `tests/modules/work-order/WorkOrderService.test.ts`
  - `tests/modules/attendance/LeaveService.test.ts`
  - `tests/modules/overtime/OvertimeService.test.ts`
  - `tests/modules/notification/NotificationService.test.ts`
  - `tests/modules/finance/customerFinanceNotifications.test.ts`

## Task 1: Add pelanggan admin query and mutation entrypoints

**Files:**
- Create: `modules/pelanggan/services/PelangganAdminQueryService.ts`
- Create: `modules/pelanggan/services/PelangganAdminMutationService.ts`
- Modify: `modules/pelanggan/index.ts`
- Test: `tests/modules/pelanggan/PelangganService.test.ts`

- [ ] **Step 1: Write the failing test surface for the new admin service exports**

```ts
import { describe, expect, it } from 'vitest'
import {
  PelangganAdminQueryService,
  PelangganAdminMutationService,
} from '@/modules/pelanggan'

describe('pelanggan admin service exports', () => {
  it('exports admin query and mutation services', () => {
    expect(PelangganAdminQueryService).toBeTypeOf('function')
    expect(PelangganAdminMutationService).toBeTypeOf('function')
  })
})
```

- [ ] **Step 2: Run the focused export test to verify it fails**

Run: `npm run test:run -- tests/modules/pelanggan/PelangganService.test.ts`
Expected: FAIL with missing export or missing file.

- [ ] **Step 3: Create the admin query service**

```ts
// modules/pelanggan/services/PelangganAdminQueryService.ts
import { prisma } from '@/modules/database'
import { CustomerUsageService } from '@/modules/pelanggan'

const usageService = new CustomerUsageService()

export class PelangganAdminQueryService {
  async getPppDetail(id: string) {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      include: {
        hargaPaket: {
          include: {
            profilePPP: { include: { mikroTikRouter: true } },
            bandwidth: true,
          },
        },
        odp: { select: { name: true, location: true } },
      },
    })

    if (!pelanggan) return null

    const technicalInfo = await usageService.getTechnicalInfo({
      username: pelanggan.username,
      tenantId: pelanggan.tenantId,
      packageRouterName: pelanggan.hargaPaket?.profilePPP?.mikroTikRouter?.name,
      odpName: pelanggan.odp?.name,
      odpLocation: pelanggan.odp?.location,
    })

    return { pelanggan, technicalInfo }
  }
}
```

- [ ] **Step 4: Create the admin mutation service**

```ts
// modules/pelanggan/services/PelangganAdminMutationService.ts
import { prisma } from '@/modules/database'
import { hash } from 'bcryptjs'
import { Status, TipePelanggan } from '@prisma/client'
import { afterCustomerUpdate, beforeCustomerDelete } from '@/lib/hooks/radius-sync-hooks'
import { AutomaticBillingService } from '@/modules/finance'

export class PelangganAdminMutationService {
  async updatePppById(input: {
    id: string
    existingStatus: Status
    data: {
      idPelanggan: string
      nama: string
      username: string
      password: string
      hargaPaketId: string
      tipe: string | null
      tanggalAktif: Date
      jatuhTempo: Date
      status: string | null
      autoIsolir: boolean
      email: string | null
      siteId: string | null
      invoiceAction: string | null
      passwordLogin: string | null
    }
  }) {
    const { id, existingStatus, data } = input

    const pelanggan = await prisma.pelanggan.update({
      where: { id },
      data: {
        idPelanggan: data.idPelanggan.trim(),
        nama: data.nama.trim(),
        username: data.username.trim(),
        password: data.password.trim(),
        hargaPaketId: data.hargaPaketId,
        tipe: (data.tipe as TipePelanggan | null) ?? TipePelanggan.REGULER,
        tanggalAktif: data.tanggalAktif,
        jatuhTempo: data.jatuhTempo,
        status: (data.status as Status | null) ?? Status.AKTIF,
        autoIsolir: data.autoIsolir,
        email: data.email?.trim() || null,
        siteId: data.siteId,
        ...(data.passwordLogin ? { passwordHash: await hash(data.passwordLogin.trim(), 12) } : {}),
      },
    })

    await afterCustomerUpdate(prisma, id, {
      statusChanged: true,
      oldStatus: existingStatus,
      newStatus: pelanggan.status,
      packageChanged: true,
      passwordChanged: true,
    })

    if (data.invoiceAction === 'VOID_AND_CREATE_NEW') {
      await AutomaticBillingService.generateImmediateInvoice(pelanggan.id, false)
    }

    return pelanggan
  }

  async deletePppById(id: string, username: string) {
    await beforeCustomerDelete(prisma, username)
    return prisma.pelanggan.delete({ where: { id } })
  }
}
```

- [ ] **Step 5: Export the new services from the pelanggan module**

```ts
// modules/pelanggan/index.ts
export * from './services/PelangganAdminQueryService'
export * from './services/PelangganAdminMutationService'
```

- [ ] **Step 6: Run the focused pelanggan module test**

Run: `npm run test:run -- tests/modules/pelanggan/PelangganService.test.ts`
Expected: PASS

## Task 2: Thin down `app/api/pelanggan-ppp/[id]/route.ts`

**Files:**
- Modify: `app/api/pelanggan-ppp/[id]/route.ts`
- Test: `tests/modules/pelanggan/PelangganService.test.ts`

- [ ] **Step 1: Add a focused route-level regression test block for service delegation assumptions**

```ts
it('keeps pelanggan update orchestration in service layer', async () => {
  const service = new PelangganAdminMutationService()
  expect(service.updatePppById).toBeTypeOf('function')
})
```

- [ ] **Step 2: Run the pelanggan-focused test**

Run: `npm run test:run -- tests/modules/pelanggan/PelangganService.test.ts`
Expected: FAIL if the service is not imported/exported correctly.

- [ ] **Step 3: Rewrite the route so GET/PUT/DELETE delegate to services**

```ts
// inside app/api/pelanggan-ppp/[id]/route.ts
import {
  CustomerUsageService,
  PelangganAdminMutationService,
  PelangganAdminQueryService,
} from '@/modules/pelanggan'

const pelangganAdminQueryService = new PelangganAdminQueryService()
const pelangganAdminMutationService = new PelangganAdminMutationService()

// GET
const result = await pelangganAdminQueryService.getPppDetail(id)

// PUT
const pelanggan = await pelangganAdminMutationService.updatePppById({
  id,
  existingStatus: existingPelanggan.status,
  data: {
    idPelanggan,
    nama,
    username,
    password,
    hargaPaketId,
    tipe: parseEnumValue(tipe, TipePelanggan),
    tanggalAktif: tanggalAktifDate,
    jatuhTempo: jatuhTempoDate,
    status: parseEnumValue(status, Status),
    autoIsolir,
    email,
    siteId: siteIdRaw === '' ? null : siteIdRaw,
    invoiceAction,
    passwordLogin,
  },
})

// DELETE
await pelangganAdminMutationService.deletePppById(id, pelanggan.username)
```

- [ ] **Step 4: Keep only HTTP concerns in the route**

```ts
// retain in route
- auth/session extraction
- tenant scope lookup
- access checks
- request parsing
- response serialization
- revalidatePath
```

- [ ] **Step 5: Run the pelanggan-focused test again**

Run: `npm run test:run -- tests/modules/pelanggan/PelangganService.test.ts`
Expected: PASS

## Task 3: Move PPP detail page data access out of the page file

**Files:**
- Create: `app/admin/pelanggan/ppp/[id]/pppDetailQuery.ts`
- Modify: `app/admin/pelanggan/ppp/[id]/PppDetailClient.tsx`
- Test: `npm run typecheck`

- [ ] **Step 1: Create a failing import by moving the data dependency into a helper file**

```ts
// app/admin/pelanggan/ppp/[id]/pppDetailQuery.ts
export async function getPppDetailViewModel(id: string) {
  throw new Error('not implemented')
}
```

- [ ] **Step 2: Point the page to the new query helper**

```ts
// app/admin/pelanggan/ppp/[id]/PppDetailClient.tsx
import { getPppDetailViewModel } from './pppDetailQuery'
```

Run: `npm run typecheck`
Expected: FAIL because the helper does not yet return the expected shape.

- [ ] **Step 3: Implement the query helper using the pelanggan admin query service**

```ts
// app/admin/pelanggan/ppp/[id]/pppDetailQuery.ts
import { PelangganAdminQueryService } from '@/modules/pelanggan'

const queryService = new PelangganAdminQueryService()

export async function getPppDetailViewModel(id: string) {
  return queryService.getPppDetail(id)
}
```

- [ ] **Step 4: Update `PppDetailClient.tsx` to consume the view-model helper and stop importing Prisma**

```ts
const detail = await getPppDetailViewModel(id)
if (!detail) {
  // not found UI
}
const { pelanggan, technicalInfo } = detail
```

- [ ] **Step 5: Run typecheck for the PPP detail page**

Run: `npm run typecheck`
Expected: PASS for the moved imports and page usage.

## Task 4: Split PPP list responsibilities

**Files:**
- Create: `app/admin/pelanggan/ppp/pppListActions.ts`
- Create: `app/admin/pelanggan/ppp/pppListColumns.tsx`
- Modify: `app/admin/pelanggan/ppp/PppList.tsx`
- Test: `npm run lint -- app/admin/pelanggan/ppp/PppList.tsx app/admin/pelanggan/ppp/pppListActions.ts app/admin/pelanggan/ppp/pppListColumns.tsx`

- [ ] **Step 1: Extract action handlers into a dedicated module**

```ts
// app/admin/pelanggan/ppp/pppListActions.ts
export async function deletePppCustomer(id: string) {
  const res = await fetch(`/api/pelanggan-ppp/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || 'Gagal menghapus pelanggan')
  }
}

export async function updatePppCustomerStatus(id: string, status: string) {
  const res = await fetch(`/api/pelanggan-ppp/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || 'Gagal mengubah status')
  }
}
```

- [ ] **Step 2: Extract columns and action rendering into a dedicated module**

```tsx
// app/admin/pelanggan/ppp/pppListColumns.tsx
import type { Column } from '@/components/ui/ResponsiveTable'
import { StatusBadge } from '@/components/common/StatusBadge'

export function createPppListColumns(/* required args */): Column<PelangganPPP>[] {
  return [
    {
      key: 'nama',
      header: 'Nama Pelanggan',
      render: (item) => <div>{item.nama}</div>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ]
}
```

- [ ] **Step 3: Refactor `PppList.tsx` to use the extracted modules**

```ts
import { createPppListColumns } from './pppListColumns'
import { deletePppCustomer, updatePppCustomerStatus } from './pppListActions'

const columns = createPppListColumns({ disableDuration })
```

- [ ] **Step 4: Keep state/fetching in `PppList.tsx`, remove the bulky inline config and fetch mutations**

```ts
// leave in PppList.tsx
- search/filter/pagination state
- loadData useCallback
- UI composition
```

- [ ] **Step 5: Run lint on the extracted PPP list files**

Run: `npm run lint -- app/admin/pelanggan/ppp/PppList.tsx app/admin/pelanggan/ppp/pppListActions.ts app/admin/pelanggan/ppp/pppListColumns.tsx`
Expected: PASS

## Task 5: Split customer invoice history fetching and mutation helpers

**Files:**
- Create: `app/admin/pelanggan/ppp/[id]/customerInvoiceHistoryApi.ts`
- Modify: `app/admin/pelanggan/ppp/[id]/CustomerInvoiceHistory.tsx`
- Test: `npm run lint -- app/admin/pelanggan/ppp/[id]/CustomerInvoiceHistory.tsx app/admin/pelanggan/ppp/[id]/customerInvoiceHistoryApi.ts`

- [ ] **Step 1: Extract API calls from the component**

```ts
// app/admin/pelanggan/ppp/[id]/customerInvoiceHistoryApi.ts
export async function fetchCustomerInvoices(pelangganId: string) {
  const res = await fetch(`/api/admin/pelanggan/${pelangganId}/invoices`)
  return res.json()
}

export async function cancelCustomerPayment(paymentId: string) {
  const res = await fetch(`/api/admin/payments/${paymentId}/cancel`, { method: 'POST' })
  return res.json()
}
```

- [ ] **Step 2: Update the component to use the extracted API helpers**

```ts
import { cancelCustomerPayment, fetchCustomerInvoices } from './customerInvoiceHistoryApi'

const data = await fetchCustomerInvoices(pelangganId)
const result = await cancelCustomerPayment(cancellingPaymentId)
```

- [ ] **Step 3: Keep only component state and rendering inside `CustomerInvoiceHistory.tsx`**

```ts
// keep in component
- local loading/error/modal state
- toast calls
- router.refresh
- presentational rendering
```

- [ ] **Step 4: Run lint on the invoice history files**

Run: `npm run lint -- app/admin/pelanggan/ppp/[id]/CustomerInvoiceHistory.tsx app/admin/pelanggan/ppp/[id]/customerInvoiceHistoryApi.ts`
Expected: PASS

## Task 6: Add page-level query services for dashboard and admin pages

**Files:**
- Create: `modules/admin/services/AdminDashboardPageService.ts`
- Create: `modules/integrations/services/MixRadiusPageService.ts`
- Create: `modules/finance/services/FinancePageQueriesService.ts`
- Modify: `modules/admin/index.ts`
- Modify: `modules/integrations/index.ts`
- Modify: `modules/finance/index.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Add the dashboard page service file**

```ts
// modules/admin/services/AdminDashboardPageService.ts
import { getDashboardService } from './DashboardService'
import { getMikroTikRouterRepository } from '@/lib/repositories'

export class AdminDashboardPageService {
  async getDashboardData(tenantId: string) {
    const routerRepository = getMikroTikRouterRepository()
    const dashboardService = getDashboardService()

    const [routerStats, topEmployees, topProblematicSites, topDismantleSites, topInstallationSites, systemSummary] = await Promise.all([
      routerRepository.getStatistics(tenantId),
      dashboardService.getTopEmployees(),
      dashboardService.getTopProblematicSites(),
      dashboardService.getTopDismantleSites(),
      dashboardService.getTopInstallationSites(),
      dashboardService.getSystemSummary(),
    ])

    return { routerStats, topEmployees, topProblematicSites, topDismantleSites, topInstallationSites, systemSummary }
  }
}
```

- [ ] **Step 2: Add the MixRadius page service**

```ts
// modules/integrations/services/MixRadiusPageService.ts
import { prisma } from '@/modules/database'

export class MixRadiusPageService {
  async shouldRedirectToDashboard() {
    const setting = await prisma.settings.findFirst({ where: { key: 'PPP_CONNECTION_MODE' } })
    return setting?.value === 'MIKROTIK_API'
  }
}
```

- [ ] **Step 3: Add the finance page query service**

```ts
// modules/finance/services/FinancePageQueriesService.ts
import { prisma } from '@/modules/database'

export class FinancePageQueriesService {
  async getUnpaidBillsPageData() {
    const [unpaidPos, accounts] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['ORDERED', 'RECEIVED', 'PARTIAL'] },
          paymentStatus: { not: 'PAID' },
        },
        include: { supplier: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.financialAccount.findMany({
        where: { isActive: true },
        orderBy: { type: 'asc' },
      }),
    ])

    return { unpaidPos, accounts }
  }
}
```

- [ ] **Step 4: Export the new page services from their modules**

```ts
// modules/admin/index.ts
export * from './services/AdminDashboardPageService'

// modules/integrations/index.ts
export * from './services/MixRadiusPageService'

// modules/finance/index.ts
export * from './services/FinancePageQueriesService'
```

- [ ] **Step 5: Run typecheck after adding the service entrypoints**

Run: `npm run typecheck`
Expected: PASS or only downstream import failures in app files that will be fixed in the next task.

## Task 7: Refactor dashboard and admin pages to use page services

**Files:**
- Modify: `app/admin/AdminDashboardClient.tsx`
- Modify: `app/admin/integrations/mixradius/page.tsx`
- Modify: `app/admin/finance/unpaid/page.tsx`
- Test: `npm run lint -- app/admin/AdminDashboardClient.tsx app/admin/integrations/mixradius/page.tsx app/admin/finance/unpaid/page.tsx`

- [ ] **Step 1: Replace direct repository access in the dashboard page**

```ts
import { AdminDashboardPageService, getDashboardService } from '@/modules/admin'

const pageService = new AdminDashboardPageService()
const {
  routerStats,
  topEmployees,
  topProblematicSites,
  topDismantleSites,
  topInstallationSites,
  systemSummary,
} = await pageService.getDashboardData(user.tenantId!)
```

- [ ] **Step 2: Replace direct Prisma access in the MixRadius page**

```ts
import { MixRadiusPageService } from '@/modules/integrations'

const pageService = new MixRadiusPageService()
if (await pageService.shouldRedirectToDashboard()) {
  redirect('/admin/dashboard')
}
```

- [ ] **Step 3: Replace direct Prisma access in the unpaid bills page**

```ts
import { FinancePageQueriesService } from '@/modules/finance'

const pageService = new FinancePageQueriesService()
const { unpaidPos, accounts } = await pageService.getUnpaidBillsPageData()
```

- [ ] **Step 4: Run lint on the refactored admin pages**

Run: `npm run lint -- app/admin/AdminDashboardClient.tsx app/admin/integrations/mixradius/page.tsx app/admin/finance/unpaid/page.tsx`
Expected: PASS

## Task 8: Add employee page query services and refactor pages

**Files:**
- Create: `modules/work-order/services/EmployeeWorkOrderQueryService.ts`
- Create: `modules/attendance/services/EmployeeLeaveQueryService.ts`
- Create: `modules/overtime/services/EmployeeOvertimeQueryService.ts`
- Modify: `modules/work-order/index.ts`
- Modify: `modules/attendance/index.ts`
- Modify: `modules/overtime/index.ts`
- Modify: `app/karyawan/work-order/page.tsx`
- Modify: `app/karyawan/izin/page.tsx`
- Modify: `app/karyawan/lembur/page.tsx`
- Test: `tests/modules/work-order/WorkOrderService.test.ts`
- Test: `tests/modules/attendance/LeaveService.test.ts`
- Test: `tests/modules/overtime/OvertimeService.test.ts`

- [ ] **Step 1: Add the employee work-order query service**

```ts
// modules/work-order/services/EmployeeWorkOrderQueryService.ts
import { getWorkOrderRepository } from '@/lib/repositories'

export class EmployeeWorkOrderQueryService {
  async getAssignedWorkOrders(userId: string) {
    const repo = getWorkOrderRepository()
    return repo.findAllForList({ assignedToId: userId })
  }
}
```

- [ ] **Step 2: Add the employee leave query service**

```ts
// modules/attendance/services/EmployeeLeaveQueryService.ts
import { LeaveRepository } from '../repositories/LeaveRepository'

export class EmployeeLeaveQueryService {
  private leaveRepository = new LeaveRepository()

  async getRecentRequests(userId: string) {
    return this.leaveRepository.findAll({ userId, take: 20 })
  }
}
```

- [ ] **Step 3: Add the employee overtime query service**

```ts
// modules/overtime/services/EmployeeOvertimeQueryService.ts
import { OvertimeRepository } from '../repositories/OvertimeRepository'

export class EmployeeOvertimeQueryService {
  private overtimeRepository = new OvertimeRepository()

  async getRecentRequests(userId: string) {
    return this.overtimeRepository.findAll({ userId, take: 20 })
  }
}
```

- [ ] **Step 4: Export the new query services**

```ts
// modules/work-order/index.ts
export * from './services/EmployeeWorkOrderQueryService'

// modules/attendance/index.ts
export * from './services/EmployeeLeaveQueryService'

// modules/overtime/index.ts
export * from './services/EmployeeOvertimeQueryService'
```

- [ ] **Step 5: Refactor the employee pages to use the new query services**

```ts
// app/karyawan/work-order/page.tsx
import { EmployeeWorkOrderQueryService } from '@/modules/work-order'
const service = new EmployeeWorkOrderQueryService()
const { workOrders } = await service.getAssignedWorkOrders(userId)

// app/karyawan/izin/page.tsx
import { EmployeeLeaveQueryService } from '@/modules/attendance'
const service = new EmployeeLeaveQueryService()
const requests = userId ? await service.getRecentRequests(userId) : []

// app/karyawan/lembur/page.tsx
import { EmployeeOvertimeQueryService } from '@/modules/overtime'
const service = new EmployeeOvertimeQueryService()
const requests = userId ? await service.getRecentRequests(userId) : []
```

- [ ] **Step 6: Run the focused module tests**

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts tests/modules/attendance/LeaveService.test.ts tests/modules/overtime/OvertimeService.test.ts`
Expected: PASS

## Task 9: Remove cross-module repository imports from finance and notification hotspots

**Files:**
- Create: `modules/pelanggan/services/PelangganBillingBridgeService.ts`
- Create: `modules/pelanggan/services/PelangganPushTokenService.ts`
- Modify: `modules/pelanggan/index.ts`
- Modify: `modules/finance/services/AutomaticBillingService.ts`
- Modify: `modules/finance/services/AutomaticIsolationService.ts`
- Modify: `modules/notification/services/ExpoPushService.ts`
- Test: `tests/modules/notification/NotificationService.test.ts`
- Test: `tests/modules/finance/customerFinanceNotifications.test.ts`

- [ ] **Step 1: Add the pelanggan billing bridge service**

```ts
// modules/pelanggan/services/PelangganBillingBridgeService.ts
import { PelangganRepository } from '../repositories/PelangganRepository'
import { PelangganFinanceRepository } from '../repositories/PelangganFinanceRepository'

export class PelangganBillingBridgeService {
  private pelangganRepo = new PelangganRepository()
  private pelangganFinanceRepo = new PelangganFinanceRepository()

  findEligibleForBilling(targetDay: number, limit: number, offset: number) {
    return this.pelangganRepo.findEligibleForBilling(targetDay, limit, offset)
  }

  findByIdWithHargaPaket(id: string) {
    return this.pelangganRepo.findByIdWithHargaPaket(id)
  }

  findById(id: string) {
    return this.pelangganRepo.findById(id)
  }

  updateStatus(id: string, status: string) {
    return this.pelangganFinanceRepo.update(id, { status })
  }
}
```

- [ ] **Step 2: Add the pelanggan push token service**

```ts
// modules/pelanggan/services/PelangganPushTokenService.ts
import { PelangganRepository } from '../repositories/PelangganRepository'

export class PelangganPushTokenService {
  private pelangganRepo = new PelangganRepository()

  findManyWithPushToken(tokens: string[]) {
    return this.pelangganRepo.findManyWithPushToken(tokens)
  }

  clearPushTokens(tokens: string[]) {
    return this.pelangganRepo.clearPushTokens(tokens)
  }
}
```

- [ ] **Step 3: Export the bridge services from `modules/pelanggan/index.ts`**

```ts
export * from './services/PelangganBillingBridgeService'
export * from './services/PelangganPushTokenService'
```

- [ ] **Step 4: Replace repository imports in the finance and notification hotspots**

```ts
// modules/finance/services/AutomaticBillingService.ts
import { PelangganBillingBridgeService } from '@/modules/pelanggan'
private static pelangganBridge = new PelangganBillingBridgeService()

// modules/finance/services/AutomaticIsolationService.ts
import { PelangganBillingBridgeService } from '@/modules/pelanggan'
const pelangganBridge = new PelangganBillingBridgeService()

// modules/notification/services/ExpoPushService.ts
import { PelangganPushTokenService } from '@/modules/pelanggan'
let pelangganPushTokenService: PelangganPushTokenService | null = null
```

- [ ] **Step 5: Update usage sites to call bridge methods instead of foreign repositories**

```ts
const customers = await this.pelangganBridge.findEligibleForBilling(targetDay, BATCH_SIZE, offset)
const customer = await this.pelangganBridge.findByIdWithHargaPaket(pelangganId)
await pelangganBridge.updateStatus(customer.id, Status.ISOLIR)
return getPelangganPushTokenService().findManyWithPushToken(tokens)
```

- [ ] **Step 6: Run finance and notification focused tests**

Run: `npm run test:run -- tests/modules/notification/NotificationService.test.ts tests/modules/finance/customerFinanceNotifications.test.ts`
Expected: PASS

## Task 10: Remove cross-module repository imports from inventory hotspot

**Files:**
- Create: `modules/finance/services/FinanceExpenseBridgeService.ts`
- Modify: `modules/finance/index.ts`
- Modify: `modules/inventory/services/AssetService.ts`
- Test: `tests/modules/inventory/InventoryRepository.test.ts`

- [ ] **Step 1: Add the finance expense bridge service**

```ts
// modules/finance/services/FinanceExpenseBridgeService.ts
import { ExpenseCategoryRepository } from '../repositories/ExpenseCategoryRepository'
import { ExpenseRepository } from '../repositories/ExpenseRepository'

export class FinanceExpenseBridgeService {
  private expenseCategoryRepo = new ExpenseCategoryRepository()
  private expenseRepo = new ExpenseRepository()

  findDepreciationCategory(tenantId: string) {
    return this.expenseCategoryRepo.findFirst({
      tenantId,
      OR: [
        { name: { contains: 'penyusutan', mode: 'insensitive' } },
        { name: { contains: 'depreciation', mode: 'insensitive' } },
      ],
    })
  }

  createDepreciationExpense(input: {
    amount: bigint
    date: Date
    expenseCategoryId: string
    category: string
    description: string
    userId: string
  }) {
    return this.expenseRepo.createDepreciationExpense(input)
  }
}
```

- [ ] **Step 2: Export the finance expense bridge service**

```ts
// modules/finance/index.ts
export * from './services/FinanceExpenseBridgeService'
```

- [ ] **Step 3: Refactor `AssetService` to depend on the finance bridge service**

```ts
import { FinanceExpenseBridgeService } from '@/modules/finance'

private financeExpenseBridge = new FinanceExpenseBridgeService()

const depCategory = await this.financeExpenseBridge.findDepreciationCategory(asset.tenantId)
await this.financeExpenseBridge.createDepreciationExpense({
  amount: BigInt(Math.round(actualAmount)),
  date: customDate,
  expenseCategoryId: depCategory.id,
  category: 'Depresiasi Aset',
  description: `Penyusutan Aset: ${asset.barang.nama} (${asset.kodeAsset})`,
  userId: createdById,
})
```

- [ ] **Step 4: Run the inventory-focused test**

Run: `npm run test:run -- tests/modules/inventory/InventoryRepository.test.ts`
Expected: PASS

## Task 11: Verification and cleanup

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

- [ ] **Step 4: Fix any failing import, type, or compile issue at the source**

```ts
// examples of acceptable follow-up fixes
- export missing service entrypoints from module index.ts
- tighten helper return types for moved query functions
- remove stale imports after extraction
- update tests that import moved symbols
```

- [ ] **Step 5: Re-run the full verification sequence**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

## Self-review
- Spec coverage check: all four slices are represented by Tasks 1-11.
- Placeholder scan: no TODO/TBD placeholders remain; each task includes paths and commands.
- Type consistency check: planned service names and filenames match across later tasks.
