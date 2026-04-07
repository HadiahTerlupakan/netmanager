# Architecture Boundary Refactor Batch 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining highest-signal thin-route and cross-module boundary leaks so route controllers hand off orchestration to owner-module services instead of directly coordinating Prisma, repositories, notifications, and external integrations.

**Architecture:** This batch finishes the most active controller-layer leaks by adding owner-module application services/facades in `network`, `attendance`, and `work-order`, then moving the PPP profile orchestration out of routes and replacing the remaining finance-to-pelanggan repository reach-through with an existing bridge surface. The work stays narrow: preserve behavior, prefer module root exports, and keep verification green after each slice.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest

---

## File map

### MikroTik router route thin-controller slice
- Create: `modules/network/services/MikroTikRouterService.ts`
- Modify: `modules/network/index.ts`
- Modify: `app/api/mikrotik-routers/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/generate-api-user/route.ts`
- Modify: `app/api/mikrotik-routers/test-connection/route.ts`

### Mobile leave orchestration slice
- Create: `modules/attendance/services/MobileLeaveRequestService.ts`
- Modify: `modules/attendance/index.ts`
- Modify: `app/api/mobile/leaves/route.ts`

### Mobile work-order request orchestration slice
- Create: `modules/work-order/services/MobileWorkOrderRequestService.ts`
- Modify: `modules/work-order/index.ts`
- Modify: `app/api/mobile/work-orders/request/route.ts`

### Work-order dashboard query slice
- Create: `modules/work-order/services/AdminWorkOrderDashboardService.ts`
- Modify: `modules/work-order/index.ts`
- Modify: `app/api/admin/workorders/dashboard/route.ts`
- Modify: `app/api/admin/workorders/analytics/route.ts`

### PPP profile orchestration slice
- Create: `modules/network/services/ProfilePPPService.ts`
- Modify: `modules/network/index.ts`
- Modify: `app/api/profileppps/route.ts`
- Modify: `app/api/profileppps/[id]/route.ts`

### Finance boundary cleanup slice
- Modify: `modules/finance/services/VoidInvoiceService.ts`
- Modify if needed: `modules/pelanggan/services/PelangganBillingBridgeService.ts`
- Modify if needed: `modules/pelanggan/index.ts`

### Verification slice
- Modify tests only if API/service surfaces require updates:
  - `tests/modules/work-order/WorkOrderService.test.ts`
  - `tests/modules/attendance/LeaveService.test.ts`
  - `tests/modules/network/**/*.test.ts`

## Task 1: Thin the MikroTik router API routes behind a network facade

**Files:**
- Create: `modules/network/services/MikroTikRouterService.ts`
- Modify: `modules/network/index.ts`
- Modify: `app/api/mikrotik-routers/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/route.ts`
- Modify: `app/api/mikrotik-routers/[id]/generate-api-user/route.ts`
- Modify: `app/api/mikrotik-routers/test-connection/route.ts`
- Test: `npm run lint -- app/api/mikrotik-routers modules/network/services/MikroTikRouterService.ts`

- [ ] **Step 1: Add a network-owned application service for router CRUD and provisioning flows**

```ts
// modules/network/services/MikroTikRouterService.ts
export class MikroTikRouterService {
  private routerRepository = new MikroTikRouterRepository()

  async listRouters(input: { userId: string; role?: string | null; tenantId: string | null; search?: string; page: number; limit: number }) {
    const siteId = await this.resolveRestrictedSiteId(input.userId, input.role)
    const filters: Record<string, string | undefined> = {
      ...(input.search ? { search: input.search } : {}),
      ...(siteId ? { siteId } : {}),
    }

    return this.routerRepository.findWithFilters(filters, { page: input.page, limit: input.limit }, input.tenantId)
  }

  async generateApiUser(input: { id: string; tenantId: string | null; userId: string; role?: string | null }) {
    const router = await this.getAuthorizedRouter(input)
    const provisioningService = new MikroTikProvisioningService()
    const result = await provisioningService.createApiUser({
      ip: router.ipAddress,
      port: router.apiPort,
      username: router.apiUsername,
      password: router.apiPassword,
    })

    if (result.success) {
      await prisma.mikroTikRouter.update({
        where: { id: router.id },
        data: {
          ...(result.username ? { apiUsernameGenerated: result.username } : {}),
          ...(result.password ? { apiPasswordGenerated: result.password } : {}),
        },
      })
    }

    return { router, result }
  }
}
```

- [ ] **Step 2: Export the service from the network module root**

```ts
// modules/network/index.ts
export * from './services/MikroTikRouterService'
```

- [ ] **Step 3: Replace route-local orchestration with service calls**

```ts
// app/api/mikrotik-routers/route.ts
const service = new MikroTikRouterService()
const result = await service.listRouters({
  userId: ctx.session!.user.id,
  role: ctx.session!.user.role,
  tenantId: ctx.session!.user.tenantId,
  search,
  page,
  limit,
})
return apiSuccess(result)

// app/api/mikrotik-routers/[id]/generate-api-user/route.ts
const service = new MikroTikRouterService()
const { result } = await service.generateApiUser({
  id,
  tenantId: ctx.session!.user.tenantId,
  userId: ctx.session!.user.id,
  role: ctx.session!.user.role,
})
```

- [ ] **Step 4: Keep `test-connection` as a thin adapter over service-owned credential resolution**

```ts
// app/api/mikrotik-routers/test-connection/route.ts
const service = new MikroTikRouterService()
const testResult = await service.testConnection({
  tenantId: ctx.session!.user.tenantId,
  routerId,
  ipAddress,
  apiPort,
  apiUsername,
  apiPassword,
})
return apiSuccess(testResult)
```

- [ ] **Step 5: Run focused lint for the route tree**

Run: `npm run lint -- app/api/mikrotik-routers modules/network/services/MikroTikRouterService.ts`
Expected: PASS

## Task 2: Move mobile leave submission workflow into the attendance module

**Files:**
- Create: `modules/attendance/services/MobileLeaveRequestService.ts`
- Modify: `modules/attendance/index.ts`
- Modify: `app/api/mobile/leaves/route.ts`
- Test: `npm run test:run -- tests/modules/attendance/LeaveService.test.ts`

- [ ] **Step 1: Add a dedicated attendance application service for mobile leave submission**

```ts
// modules/attendance/services/MobileLeaveRequestService.ts
export class MobileLeaveRequestService {
  private leaveRepository = new LeaveRepository()
  private leaveBalanceRepository = new LeaveBalanceRepository()

  async submit(input: {
    userId: string
    tenantId: string
    type: string
    startDate: string
    endDate: string
    reason: string
    photos?: string[]
    replacementDate?: string | null
  }) {
    const userData = await prisma.user.findFirst({
      where: { id: input.userId, tenantId: input.tenantId },
      select: { workingHourMode: true, workDays: true, name: true, siteId: true },
    })

    const attachments = await this.persistAttachments(input.userId, input.photos ?? [])
    const requestData = await this.leaveRepository.create(/* mapped payload */)
    await this.notifyApprovers({ tenantId: input.tenantId, siteId: userData?.siteId ?? null, userName: userData?.name ?? 'Unknown', leaveId: requestData.id, reason: input.reason, type: input.type })
    return requestData
  }
}
```

- [ ] **Step 2: Export the new attendance service from the module root**

```ts
// modules/attendance/index.ts
export * from './services/MobileLeaveRequestService'
```

- [ ] **Step 3: Reduce the route to auth + validation + service call**

```ts
// app/api/mobile/leaves/route.ts
const service = new MobileLeaveRequestService()
const requestData = await service.submit({
  userId,
  tenantId,
  type,
  startDate,
  endDate,
  reason,
  photos,
  replacementDate,
})
return NextResponse.json({ success: true, data: requestData }, { status: 201 })
```

- [ ] **Step 4: Run focused leave tests**

Run: `npm run test:run -- tests/modules/attendance/LeaveService.test.ts`
Expected: PASS

## Task 3: Move mobile work-order request orchestration into the work-order module

**Files:**
- Create: `modules/work-order/services/MobileWorkOrderRequestService.ts`
- Modify: `modules/work-order/index.ts`
- Modify: `app/api/mobile/work-orders/request/route.ts`
- Test: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`

- [ ] **Step 1: Add a work-order application service for mobile request submission**

```ts
// modules/work-order/services/MobileWorkOrderRequestService.ts
export class MobileWorkOrderRequestService {
  private workOrderRepository = new WorkOrderRepository(prisma)

  async submit(input: {
    userId: string
    userName: string
    tenantId: string
    siteId?: string | null
    body: Record<string, unknown>
  }) {
    const departmentId = await this.resolveDepartmentId(input.userId, input.tenantId, input.body.departmentId as string | undefined)
    const workOrder = await this.workOrderRepository.createRequest({
      /* existing route mapping */
    })

    await this.broadcastNewRequest(workOrder)
    await this.notifyApprovers(workOrder, input.userName, input.tenantId)
    return workOrder
  }
}
```

- [ ] **Step 2: Export the service from the work-order module root**

```ts
// modules/work-order/index.ts
export * from './services/MobileWorkOrderRequestService'
```

- [ ] **Step 3: Replace the route body with one service call**

```ts
// app/api/mobile/work-orders/request/route.ts
const service = new MobileWorkOrderRequestService()
const workOrder = await service.submit({
  userId,
  userName,
  tenantId,
  siteId: userSession.siteId,
  body,
})
return apiSuccess(workOrder, { message: 'Work Order request berhasil diajukan. Menunggu persetujuan Admin.', status: 201 })
```

- [ ] **Step 4: Run focused work-order tests**

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

## Task 4: Move work-order dashboard analytics composition into a module service

**Files:**
- Create: `modules/work-order/services/AdminWorkOrderDashboardService.ts`
- Modify: `modules/work-order/index.ts`
- Modify: `app/api/admin/workorders/dashboard/route.ts`
- Modify: `app/api/admin/workorders/analytics/route.ts`
- Test: `npm run lint -- app/api/admin/workorders/dashboard/route.ts app/api/admin/workorders/analytics/route.ts modules/work-order/services/AdminWorkOrderDashboardService.ts`

- [ ] **Step 1: Add a read-oriented dashboard service owned by the work-order module**

```ts
// modules/work-order/services/AdminWorkOrderDashboardService.ts
export class AdminWorkOrderDashboardService {
  private workOrderRepository = new WorkOrderRepository(prisma)

  async getDashboard(input: { userId: string; role?: string | null; permissions: string[]; period: string }) {
    const restrictions = await this.resolveAccessFilters(input.userId, input.role, input.permissions)
    if (restrictions.emptyResponse) return getEmptyDashboardData()

    const { dateFrom, dateTo } = this.buildDateRange(input.period)
    const [stats, recentWorkOrders, departmentWorkload, topPerformers, topAssists, issueStats, siteStats, disconnectionStats, responseStats, adminKPI] = await Promise.all([
      this.workOrderRepository.getStatistics(restrictions.filters),
      this.workOrderRepository.getRecentWorkOrders(5, restrictions.departmentFilter),
      this.workOrderRepository.getDepartmentWorkload(restrictions.departmentId),
      this.workOrderRepository.getTopPerformers(5, dateFrom, dateTo, restrictions.departmentId),
      this.workOrderRepository.getTopAssists(5, dateFrom, dateTo, restrictions.departmentId),
      this.workOrderRepository.getIssueStatistics(5, dateFrom, dateTo, restrictions.departmentId, restrictions.siteId),
      this.workOrderRepository.getSiteStatistics(5, dateFrom, dateTo, restrictions.departmentId, restrictions.siteId),
      this.workOrderRepository.getDisconnectionStatistics(dateFrom, dateTo, restrictions.departmentId, restrictions.siteId),
      this.workOrderRepository.getAdminResponseStats(dateFrom ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), dateTo ?? new Date(), restrictions.departmentId),
      this.workOrderRepository.getAdminKPIStats(restrictions.departmentId, restrictions.siteId),
    ])

    return { stats, recentWorkOrders, departmentWorkload, topPerformers, topAssists, issueStats, siteStats, disconnectionStats, responseStats, adminKPI }
  }
}
```

- [ ] **Step 2: Export the new query service from the module root**

```ts
// modules/work-order/index.ts
export * from './services/AdminWorkOrderDashboardService'
```

- [ ] **Step 3: Replace both admin routes with module service calls**

```ts
// app/api/admin/workorders/dashboard/route.ts
const service = new AdminWorkOrderDashboardService()
const dashboardData = await service.getDashboard({
  userId: user.id,
  role: user.role,
  permissions: ctx.permissions || [],
  period,
})
return apiSuccess({ ...dashboardData, cached: false })

// app/api/admin/workorders/analytics/route.ts
const service = new AdminWorkOrderDashboardService()
const analytics = await service.getAnalytics({
  userId: user.id,
  role: user.role,
  permissions: ctx.permissions || [],
  period,
})
return apiSuccess(analytics)
```

- [ ] **Step 4: Run focused lint on the dashboard slice**

Run: `npm run lint -- app/api/admin/workorders/dashboard/route.ts app/api/admin/workorders/analytics/route.ts modules/work-order/services/AdminWorkOrderDashboardService.ts`
Expected: PASS

## Task 5: Move PPP profile creation/update orchestration into the network module

**Files:**
- Create: `modules/network/services/ProfilePPPService.ts`
- Modify: `modules/network/index.ts`
- Modify: `app/api/profileppps/route.ts`
- Modify: `app/api/profileppps/[id]/route.ts`
- Test: `npm run lint -- app/api/profileppps modules/network/services/ProfilePPPService.ts`

- [ ] **Step 1: Add a network-owned application service for create/update PPP profile flows**

```ts
// modules/network/services/ProfilePPPService.ts
export class ProfilePPPService {
  async create(input: { sessionUser: Record<string, unknown>; body: Record<string, unknown> }) {
    const sanitizedBody = this.sanitizeBody(input.body)
    const validation = profilePPPSchema.safeParse(sanitizedBody)
    if (!validation.success) {
      return { validationError: validation.error.flatten() }
    }

    const profilePPP = await prisma.profilePPP.create({ /* mapped data */ })
    await this.syncRadiusOnCreate(profilePPP, sanitizedBody.ipRange, input.sessionUser)
    await this.syncMikroTikOnCreate(profilePPP, validation.data)
    return { profilePPP }
  }
}
```

- [ ] **Step 2: Export the service from the network module root**

```ts
// modules/network/index.ts
export * from './services/ProfilePPPService'
```

- [ ] **Step 3: Reduce the create/update routes to auth + service delegation**

```ts
// app/api/profileppps/route.ts
const service = new ProfilePPPService()
const result = await service.create({ sessionUser: session.user, body })
if ('validationError' in result) {
  return NextResponse.json({ error: 'Validasi gagal', details: result.validationError }, { status: 400 })
}
return NextResponse.json(result.profilePPP, { status: 201 })

// app/api/profileppps/[id]/route.ts
const service = new ProfilePPPService()
const result = await service.update({ id, sessionUser: session.user, body })
```

- [ ] **Step 4: Run focused lint on the PPP profile slice**

Run: `npm run lint -- app/api/profileppps modules/network/services/ProfilePPPService.ts`
Expected: PASS

## Task 6: Remove the remaining finance-to-pelanggan repository reach-through

**Files:**
- Modify: `modules/finance/services/VoidInvoiceService.ts`
- Modify if needed: `modules/pelanggan/services/PelangganBillingBridgeService.ts`
- Modify if needed: `modules/pelanggan/index.ts`
- Test: `npm run lint -- modules/finance/services/VoidInvoiceService.ts modules/pelanggan/services/PelangganBillingBridgeService.ts`

- [ ] **Step 1: Replace direct pelanggan repository import with the pelanggan bridge**

```ts
// modules/finance/services/VoidInvoiceService.ts
import { PelangganBillingBridgeService } from '@/modules/pelanggan'

export class VoidInvoiceService {
  private invoiceRepo: InvoiceRepository
  private pelangganBridge: PelangganBillingBridgeService

  constructor() {
    this.invoiceRepo = new InvoiceRepository()
    this.pelangganBridge = new PelangganBillingBridgeService()
  }
}
```

- [ ] **Step 2: Keep runtime behavior unchanged while routing customer lookups/updates through the bridge**

```ts
const pelanggan = await this.pelangganBridge.findById(invoice.pelangganId)
await this.pelangganBridge.update(pelanggan.id, {
  jatuhTempo: newJatuhTempo,
  status: newStatus,
})
```

- [ ] **Step 3: Run focused lint for the finance boundary fix**

Run: `npm run lint -- modules/finance/services/VoidInvoiceService.ts modules/pelanggan/services/PelangganBillingBridgeService.ts`
Expected: PASS

## Task 7: Full verification

**Files:**
- Modify any touched files required by lint/type/build follow-up

- [ ] **Step 1: Run lint for the full project**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 2: Run typecheck for the full project**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run the focused regression tests**

Run: `npm run test:run -- tests/modules/attendance/LeaveService.test.ts tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Re-run the full verification sequence**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

## Self-review
- Spec coverage check: plan covers the remaining route-heavy orchestration hotspots, the PPP profile route leak, and the last direct finance-to-pelanggan repository reach-through.
- Placeholder scan: no TODO/TBD placeholders remain; every task includes exact paths and concrete commands.
- Type consistency check: all planned replacements use module-owned services and existing owner-module exports or minimal new exports from module roots.
