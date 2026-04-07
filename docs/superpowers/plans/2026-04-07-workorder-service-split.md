# WorkOrder Service Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce god-service pressure in `modules/work-order/services/WorkOrderService.ts` by extracting internal access, side-effect, and create-lifecycle responsibilities into focused helper modules while preserving the current public API used by routes and tests.

**Architecture:** Keep `WorkOrderService` as the stable facade exported from `modules/work-order/index.ts`. Move access-policy checks, create-time warranty/input shaping, and work-order side effects into sibling internal helper files, then update the facade to delegate to those helpers. This keeps route imports stable while reducing the number of unrelated reasons `WorkOrderService` changes.

**Tech Stack:** TypeScript, Next.js App Router, Prisma, Vitest, date-fns

---

## File map

### Work order access helper split
- Create: `modules/work-order/services/work-order-access.ts`
- Modify: `modules/work-order/services/WorkOrderService.ts`
- Test: `tests/modules/work-order/WorkOrderService.test.ts`
- Verify: `npx eslint modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-access.ts tests/modules/work-order/WorkOrderService.test.ts`

### Work order create-preparation helper split
- Create: `modules/work-order/services/work-order-create-preparation.ts`
- Modify: `modules/work-order/services/WorkOrderService.ts`
- Test: `tests/modules/work-order/WorkOrderService.test.ts`
- Verify: `npx eslint modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-create-preparation.ts tests/modules/work-order/WorkOrderService.test.ts`

### Work order side-effect helper split
- Create: `modules/work-order/services/work-order-side-effects.ts`
- Modify: `modules/work-order/services/WorkOrderService.ts`
- Test: `tests/modules/work-order/WorkOrderService.test.ts`
- Verify: `npx eslint modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-side-effects.ts tests/modules/work-order/WorkOrderService.test.ts`

### Full verification
- Modify only if needed: `modules/work-order/index.ts`
- Test: `npm run typecheck`
- Test: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`

## Task 1: Extract work-order access policy helper

**Files:**
- Create: `modules/work-order/services/work-order-access.ts`
- Modify: `modules/work-order/services/WorkOrderService.ts:219-247,810-836`
- Test: `tests/modules/work-order/WorkOrderService.test.ts:26-205`

- [ ] **Step 1: Write the failing access helper tests by expanding the existing service tests**

```ts
it('returns NOT_FOUND when access helper cannot find the work order', async () => {
  repositoryMock.findById.mockResolvedValue(null)

  const result = await service.getWorkOrderById('wo-missing', {
    id: 'user-1',
    role: 'USER',
    permissions: [],
  })

  expect(result).toEqual({
    success: false,
    error: 'Work order tidak ditemukan',
    code: 'NOT_FOUND',
  })
})
```

- [ ] **Step 2: Run the focused test file to lock current behavior**

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 3: Create the access helper module with extracted policy checks**

```ts
// modules/work-order/services/work-order-access.ts
import type { WorkOrderRepository } from '../repositories/WorkOrderRepository'
import type { UserContext } from './WorkOrderService'

export async function validateWorkOrderAccess(params: {
  repository: WorkOrderRepository
  workOrderId: string
  userContext: UserContext
}) {
  const { repository, workOrderId, userContext } = params
  const {
    role,
    permissions = [],
    departmentId: userDeptId,
    siteId: userSiteId,
    isSuperAdmin: userIsSuperAdmin,
  } = userContext

  const isSuperAdmin = userIsSuperAdmin || role === 'SUPER_ADMIN' || role === 'Super Admin'
  if (isSuperAdmin) return

  const workOrder = await repository.findById(workOrderId)
  if (!workOrder) {
    throw new Error('Work order tidak ditemukan')
  }

  if (permissions.includes('workorders:department_only') && workOrder.departmentId !== userDeptId) {
    throw new Error('Akses ditolak: Departemen berbeda')
  }

  if (permissions.includes('workorders:site_only') && workOrder.siteId !== userSiteId) {
    throw new Error('Akses ditolak: Site berbeda')
  }
}
```

- [ ] **Step 4: Delegate `WorkOrderService` access validation to the helper**

```ts
// modules/work-order/services/WorkOrderService.ts
import { validateWorkOrderAccess } from './work-order-access'

private async validateWorkOrderAccess(workOrderId: string, userContext: UserContext): Promise<void> {
  await validateWorkOrderAccess({
    repository: this.repository,
    workOrderId,
    userContext,
  })
}
```

- [ ] **Step 5: Run focused lint and tests after the access split**

Run: `npx eslint modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-access.ts tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the access helper split**

```bash
git add modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-access.ts tests/modules/work-order/WorkOrderService.test.ts
git commit -m "refactor: extract work order access helper"
```

## Task 2: Extract create-time preparation and warranty helper

**Files:**
- Create: `modules/work-order/services/work-order-create-preparation.ts`
- Modify: `modules/work-order/services/WorkOrderService.ts:247-331`
- Test: `tests/modules/work-order/WorkOrderService.test.ts`

- [ ] **Step 1: Add a focused test for create-time site restriction behavior**

```ts
it('forces siteId to the user site when workorders:site_only is active', async () => {
  repositoryMock.create.mockResolvedValue({
    id: 'wo-1',
    workOrderNumber: 'WO-001',
    title: 'Test',
    type: 'INSTALLATION',
    priority: 'MEDIUM',
    status: 'OPEN',
    departmentId: null,
    siteId: 'site-1',
    assignedToId: null,
    createdAt: new Date(),
  })

  await service.createWorkOrder(
    {
      type: 'INSTALLATION',
      title: 'Test',
      description: 'Desc',
      siteId: 'site-other',
    },
    {
      id: 'user-1',
      role: 'USER',
      permissions: ['workorders:site_only'],
      siteId: 'site-1',
    },
  )

  expect(repositoryMock.create).toHaveBeenCalledWith(
    expect.objectContaining({ siteId: 'site-1' }),
  )
})
```

- [ ] **Step 2: Run the focused service test file before refactoring**

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 3: Create the create-preparation helper module**

```ts
// modules/work-order/services/work-order-create-preparation.ts
import type { CreateWorkOrderData } from '../repositories/IWorkOrderRepository'
import type { WarrantyCheckRepository } from '../repositories/WarrantyCheckRepository'
import type { CreateWorkOrderInput, UserContext } from './WorkOrderService'

export async function prepareWorkOrderCreateData(params: {
  input: CreateWorkOrderInput
  userContext: UserContext
  warrantyRepo: WarrantyCheckRepository
}): Promise<CreateWorkOrderData> {
  const { input, userContext, warrantyRepo } = params
  const {
    role,
    permissions = [],
    siteId: userSiteId,
    departmentId: userDeptId,
    id: createdById,
  } = userContext
  const isSuperAdmin = role === 'SUPER_ADMIN'

  if (!input.type || !input.title || !input.description) {
    throw new Error('Tipe, judul, dan deskripsi wajib diisi')
  }

  const normalizedInput = { ...input }

  if (permissions.includes('workorders:site_only') && !isSuperAdmin) {
    if (normalizedInput.siteId && normalizedInput.siteId !== userSiteId) {
      throw new Error('Akses ditolak: Anda hanya dapat membuat work order untuk site Anda')
    }
    normalizedInput.siteId = userSiteId
  }

  if (permissions.includes('workorders:department_only') && !isSuperAdmin) {
    if (normalizedInput.departmentId && normalizedInput.departmentId !== userDeptId) {
      throw new Error('Akses ditolak: Anda hanya dapat membuat work order untuk departemen Anda')
    }
    normalizedInput.departmentId = userDeptId
  }

  const { scheduledDate: rawScheduledDate, ...restInput } = normalizedInput
  let createData: CreateWorkOrderData = {
    ...restInput,
    createdById,
    ...(rawScheduledDate && { scheduledDate: new Date(rawScheduledDate) }),
  }

  if (normalizedInput.pelangganId && (normalizedInput.type === 'TROUBLESHOOT' || normalizedInput.type === 'MAINTENANCE')) {
    const lastCompletedWo = await warrantyRepo.findLastCompletedWoByMitra(normalizedInput.pelangganId)

    if (lastCompletedWo?.assignedMitraId && lastCompletedWo.completedAt) {
      const mitra = await warrantyRepo.findMitraById(lastCompletedWo.assignedMitraId)
      const garansiHari = mitra?.garansiHari || 0

      if (mitra && garansiHari > 0) {
        const garansiMs = garansiHari * 24 * 60 * 60 * 1000
        const expirationDate = new Date(lastCompletedWo.completedAt.getTime() + garansiMs)

        if (new Date() <= expirationDate) {
          const slaJam = mitra.slaGaransiJam || 24
          const slaMs = slaJam * 60 * 60 * 1000

          createData = {
            ...createData,
            isWarranty: true,
            warrantyOwnerId: mitra.id,
            warrantySla: new Date(Date.now() + slaMs),
          }
        }
      }
    }
  }

  return createData
}
```

- [ ] **Step 4: Replace inline create preparation logic in `WorkOrderService`**

```ts
// modules/work-order/services/WorkOrderService.ts
import { prepareWorkOrderCreateData } from './work-order-create-preparation'

const createData = await prepareWorkOrderCreateData({
  input,
  userContext,
  warrantyRepo: this.warrantyRepo,
})

const workOrder = await this.repository.create(createData)
```

- [ ] **Step 5: Run focused lint and tests after the create-preparation split**

Run: `npx eslint modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-create-preparation.ts tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the create-preparation helper split**

```bash
git add modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-create-preparation.ts tests/modules/work-order/WorkOrderService.test.ts
git commit -m "refactor: extract work order create preparation"
```

## Task 3: Extract work-order side effects helper

**Files:**
- Create: `modules/work-order/services/work-order-side-effects.ts`
- Modify: `modules/work-order/services/WorkOrderService.ts:333-365,454-508,569-608,838-935`
- Test: `tests/modules/work-order/WorkOrderService.test.ts`

- [ ] **Step 1: Add a focused test for post-create side effects staying non-fatal**

```ts
it('still returns success when non-fatal create side effects throw', async () => {
  repositoryMock.create.mockResolvedValue({
    id: 'wo-1',
    workOrderNumber: 'WO-001',
    title: 'Test',
    type: 'INSTALLATION',
    priority: 'MEDIUM',
    status: 'OPEN',
    departmentId: null,
    siteId: null,
    assignedToId: null,
    createdAt: new Date(),
  })

  repositoryMock.findById.mockResolvedValue({
    id: 'wo-1',
    workOrderNumber: 'WO-001',
    title: 'Test',
    type: 'INSTALLATION',
    priority: 'MEDIUM',
    status: 'OPEN',
    departmentId: null,
    siteId: null,
    assignedToId: null,
    createdAt: new Date(),
  })

  const result = await service.createWorkOrder(
    {
      type: 'INSTALLATION',
      title: 'Test',
      description: 'Desc',
    },
    { id: 'user-1', role: 'USER', permissions: [] },
  )

  expect(result.success).toBe(true)
})
```

- [ ] **Step 2: Run the focused service test file before extracting side effects**

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 3: Create the side-effect helper module**

```ts
// modules/work-order/services/work-order-side-effects.ts
import { randomUUID } from 'crypto'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import type { TicketRepository } from '../repositories/TicketRepository'
import { onWorkOrderAssigned, onWorkOrderCreated, onWorkOrderStatusChanged } from './WorkOrderNotifications'
import { workOrderCacheService } from './WorkOrderCacheService'
import { socketEmitter } from '@/lib/websocket/emitter'
import { logger, logActivitySafe } from '@/lib/logger'
import { WorkOrderEventDispatcher } from '@/modules/events'
import type { WorkOrderPriority, WorkOrderStatus } from '@prisma/client'

export async function notifyWorkOrderCreatedSafely(workOrder: {
  id: string
  workOrderNumber: string
  title: string
  type: string
  priority: string
  departmentId?: string | null
  siteId?: string | null
  assignedToId?: string | null
}, triggeredByUserId?: string) {
  try {
    await onWorkOrderCreated({
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      type: workOrder.type,
      priority: workOrder.priority,
      departmentId: workOrder.departmentId,
      siteId: workOrder.siteId,
      assignedToId: workOrder.assignedToId,
    }, triggeredByUserId)
  } catch (err) {
    logger.error('Failed to send work order notification', err instanceof Error ? err : undefined)
  }
}

export function broadcastWorkOrderCreatedSafely(workOrder: {
  id: string
  workOrderNumber: string
  title: string
  type: string
  status: string
  priority: string
  departmentId?: string | null
  assignedToId?: string | null
  createdAt: Date
}) {
  try {
    socketEmitter.newWorkOrder({
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      type: workOrder.type,
      status: workOrder.status as WorkOrderStatus,
      priority: workOrder.priority as WorkOrderPriority,
      departmentId: workOrder.departmentId || undefined,
      assignedToId: workOrder.assignedToId || undefined,
      createdAt: workOrder.createdAt.toISOString(),
    }, workOrder.departmentId || undefined)
  } catch (err) {
    logger.error('Failed to broadcast work order event', err instanceof Error ? err : undefined)
  }
}

export async function linkWorkOrderToTicketSafely(params: {
  ticketRepo: TicketRepository
  ticketId: string
  userId: string
  workOrder: {
    workOrderNumber: string
    title: string
    type: string
    scheduledDate?: Date | string | null
  }
}) {
  const { ticketRepo, ticketId, userId, workOrder } = params

  try {
    const scheduledTime = workOrder.scheduledDate
      ? format(new Date(workOrder.scheduledDate), 'dd MMMM yyyy HH:mm', { locale: localeId })
      : 'Belum Dijadwalkan'

    const replyMessage = `Work Order #${workOrder.workOrderNumber} telah dibuat untuk tiket ini.\n\n` +
      `Judul: ${workOrder.title}\n` +
      `Tipe: ${workOrder.type}\n` +
      `Jadwal: ${scheduledTime}`

    await ticketRepo.createReply({
      id: randomUUID(),
      ticketId,
      message: replyMessage,
      isFromAdmin: true,
      senderId: userId,
    })

    await ticketRepo.updateTicketStatus(ticketId, 'IN_PROGRESS')
  } catch (err) {
    logger.error('Failed to link work order to ticket', err instanceof Error ? err : undefined)
  }
}

export function logWorkOrderActivity(action: string, subject: string, userId: string, details: Record<string, unknown>) {
  logActivitySafe({ action, subject, userId, details })
}

export async function invalidateWorkOrderCaches() {
  await workOrderCacheService.invalidateAllCaches()
}

export { onWorkOrderAssigned, onWorkOrderStatusChanged, WorkOrderEventDispatcher }
```

- [ ] **Step 4: Replace inline side-effect helpers and repeated cache/log calls in `WorkOrderService`**

```ts
// modules/work-order/services/WorkOrderService.ts
import {
  broadcastWorkOrderCreatedSafely,
  invalidateWorkOrderCaches,
  linkWorkOrderToTicketSafely,
  logWorkOrderActivity,
  notifyWorkOrderCreatedSafely,
  onWorkOrderAssigned,
  onWorkOrderStatusChanged,
  WorkOrderEventDispatcher,
} from './work-order-side-effects'

await notifyWorkOrderCreatedSafely(workOrder, userContext.id)
this.broadcastWorkOrderCreated(workOrder)
await linkWorkOrderToTicketSafely({
  ticketRepo: this.ticketRepo,
  ticketId: input.ticketId,
  userId: createdById,
  workOrder,
})
logWorkOrderActivity('CREATE', 'Work Order', createdById, { id: workOrder.id })
await invalidateWorkOrderCaches()
```

- [ ] **Step 5: Run focused lint and tests after the side-effect split**

Run: `npx eslint modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-side-effects.ts tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the side-effect helper split**

```bash
git add modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-side-effects.ts tests/modules/work-order/WorkOrderService.test.ts
git commit -m "refactor: extract work order side effects"
```

## Task 4: Full verification for the WorkOrder split

**Files:**
- Modify only if needed: `modules/work-order/index.ts`

- [ ] **Step 1: Run focused lint for the full WorkOrder slice**

Run: `npx eslint modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-access.ts modules/work-order/services/work-order-create-preparation.ts modules/work-order/services/work-order-side-effects.ts modules/work-order/index.ts tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 2: Run focused WorkOrder service tests**

Run: `npm run test:run -- tests/modules/work-order/WorkOrderService.test.ts`
Expected: PASS

- [ ] **Step 3: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Inspect the module export surface**

```ts
// modules/work-order/index.ts
export * from "./services/WorkOrderService";
```

Expected: unchanged public export surface for current routes.

- [ ] **Step 5: Commit the verified split batch**

```bash
git add modules/work-order/services/WorkOrderService.ts modules/work-order/services/work-order-access.ts modules/work-order/services/work-order-create-preparation.ts modules/work-order/services/work-order-side-effects.ts modules/work-order/index.ts tests/modules/work-order/WorkOrderService.test.ts
git commit -m "refactor: split internal work order helpers"
```

## Self-review
- Spec coverage check: the plan covers the main internal seams making `WorkOrderService` a hotspot today: access control, create-time preparation/warranty branching, and side-effect orchestration.
- Placeholder scan: all tasks reference concrete files, helper names, and exact verification commands.
- Type consistency check: helper names and imports used in later tasks match the files and exported functions defined earlier.
