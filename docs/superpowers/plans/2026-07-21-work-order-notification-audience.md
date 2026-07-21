# Work Order Notification Audience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop work-order notification spam so Branch Manager / cross-dept users only get stakeholder-relevant events, while same-dept technicians still get “WO Baru”, and create fires in-app notifications only once.

**Architecture:** Split recipient resolution into two audiences — **POOL** (tight dept+site for new WO) and **STAKEHOLDERS** (assignee/creator/assignments + verify/approve for status/mobile actions). Fix `department_only` to check both `workorders` and `m_work_order`. Remove duplicate `notifyNewWorkOrder` from the event-bus `WORK_ORDER_CREATED` handler (socket only).

**Tech Stack:** TypeScript, Vitest, Prisma, existing `UserLookupService` + `NotificationService` modules.

**Spec:** `docs/superpowers/specs/2026-07-21-work-order-notification-audience-design.md`

## Global Constraints

- No DB migration.
- Do not rename public export `notifyAdminsAboutMobileAction` (behavior + comments only).
- Do not purge historical unread notifications in this PR.
- Do not change WhatsApp new-WO technician path except if it reuses broken recipient helper incorrectly.
- Module boundary: notification must not import work-order **services**; may use Prisma for assignment IDs or inject IDs from callers.
- Changelog entry required in `docs/CHANGELOG.md` under `[Unreleased]`.
- Conventional commits; Bahasa Indonesia messages OK if matching recent repo style (`fix(...)`, `test(...)`, `docs(...)`).
- TDD: failing test first per task.

## File map

| File | Responsibility |
|------|----------------|
| `modules/users/repositories/user-lookup.workorder.ts` | Load user permissions needed for dept_only / verify filtering |
| `modules/notification/services/NotificationService.helpers.ts` | `EligibleUser.role.permission` shape includes resource+action |
| `modules/notification/services/NotificationService.recipients.ts` | POOL + STAKEHOLDERS resolution |
| `modules/notification/services/NotificationService.types.ts` | Optional stakeholder IDs on WO notification data |
| `modules/notification/services/NotificationService.work-order-events.ts` | Wire POOL vs STAKEHOLDERS per event |
| `modules/notification/services/NotificationService.ts` | Pass-through new optional fields on mobile action if needed |
| `lib/event-bus/event-handlers.ts` | `WORK_ORDER_CREATED` → socket only |
| `modules/work-order/services/*` | Ensure create/status/mobile payloads include stakeholder IDs when available |
| `tests/modules/notification/NotificationService.recipients.test.ts` | New unit tests |
| `tests/modules/notification/event-handlers/work-order-created.handler.test.ts` | New or extend event handler test |
| `docs/CHANGELOG.md` | SOT entry |

---

### Task 1: Expand permission select on detailed user lookup

**Files:**
- Modify: `modules/users/repositories/user-lookup.workorder.ts`
- Modify: `modules/notification/services/NotificationService.helpers.ts` (`EligibleUser` type)
- Test: `tests/modules/notification/NotificationService.recipients.test.ts` (created in Task 2; Task 1 type-only may wait)

**Interfaces:**
- Consumes: Prisma `user.findMany` select
- Produces: each user’s `role.permission` as `Array<{ id: string; resource: string; action: string }>` for WO-related resources

- [ ] **Step 1: Update `EligibleUser` type**

In `NotificationService.helpers.ts`, change:

```typescript
export type EligibleUser = {
  id: string;
  name: string | null;
  departmentId: string | null;
  siteId: string | null;
  userSites: Array<{ siteId: string }>;
  role: {
    name: string;
    permission: Array<{ id: string; resource: string; action: string }>;
  } | null;
};
```

- [ ] **Step 2: Expand `findManyWithDetailedRelations` select**

In `user-lookup.workorder.ts`, replace permission `where` that only loads `site_only` with all work-order related permissions needed for filtering:

```typescript
const WORKORDER_RESOURCES = ["workorders", "m_work_order"] as const;

export function findManyWithDetailedRelations(where: Prisma.UserWhereInput) {
  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      departmentId: true,
      siteId: true,
      userSites: { select: { siteId: true } },
      role: {
        select: {
          name: true,
          permission: {
            where: {
              resource: { in: [...WORKORDER_RESOURCES] },
            },
            select: { id: true, resource: true, action: true },
          },
        },
      },
    },
  });
}
```

- [ ] **Step 3: Typecheck touched files**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -40`  
Or project script: `npm run typecheck` if fast enough.  
Expected: no new errors in helpers/recipients/user-lookup.

- [ ] **Step 4: Commit**

```bash
GIT_MASTER=1 git add \
  modules/users/repositories/user-lookup.workorder.ts \
  modules/notification/services/NotificationService.helpers.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
fix(notification): load full WO permissions for recipient filtering

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 2: Fix POOL department_only (multi-resource) + unit tests

**Files:**
- Modify: `modules/notification/services/NotificationService.recipients.ts`
- Create: `tests/modules/notification/NotificationService.recipients.test.ts`

**Interfaces:**
- Consumes: `findEligibleRecipients({ userLookupService, departmentId?, siteId?, excludeUserId? })`
- Produces: POOL list excluding users who have `department_only` on **either** `workorders` or `m_work_order` when their `departmentId` differs from WO dept (unless verify/approve or dept null)

- [ ] **Step 1: Write failing tests**

Create `tests/modules/notification/NotificationService.recipients.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EligibleUser } from "@/modules/notification/services/NotificationService.helpers";
import { findEligibleRecipients } from "@/modules/notification/services/NotificationService.recipients";

const findManyWithDetailedRelations = vi.fn();

const userLookupService = {
  findManyWithDetailedRelations,
  findManyWithCustomWhere: vi.fn(),
} as unknown as import("@/modules/users").UserLookupService;

function user(partial: Partial<EligibleUser> & { id: string }): EligibleUser {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    departmentId: partial.departmentId ?? null,
    siteId: partial.siteId ?? "site-cariu",
    userSites: partial.userSites ?? [{ siteId: "site-cariu" }],
    role: partial.role ?? {
      name: "Role",
      permission: [{ id: "p1", resource: "workorders", action: "read" }],
    },
  };
}

describe("findEligibleRecipients (POOL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes branch manager with m_work_order:department_only in other department", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      user({
        id: "dede",
        departmentId: "dept-ops",
        role: {
          name: "Branch Manager",
          permission: [
            { id: "1", resource: "workorders", action: "read" },
            { id: "2", resource: "m_work_order", action: "read" },
            { id: "3", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
      user({
        id: "luthpi",
        departmentId: "dept-tech",
        role: {
          name: "Teknisi",
          permission: [
            { id: "4", resource: "m_work_order", action: "read" },
            { id: "5", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      departmentId: "dept-tech",
      siteId: "site-cariu",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["luthpi"]);
  });

  it("includes same-dept technician in POOL", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      user({
        id: "tech-1",
        departmentId: "dept-tech",
        role: {
          name: "Teknisi",
          permission: [
            { id: "1", resource: "m_work_order", action: "read" },
            { id: "2", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      departmentId: "dept-tech",
      siteId: "site-cariu",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["tech-1"]);
  });

  it("includes verify user cross-dept", async () => {
    findManyWithDetailedRelations.mockResolvedValue([
      user({
        id: "verifier",
        departmentId: "dept-ops",
        role: {
          name: "Manager",
          permission: [
            { id: "1", resource: "workorders", action: "read" },
            { id: "2", resource: "workorders", action: "verify" },
            { id: "3", resource: "m_work_order", action: "department_only" },
          ],
        },
      }),
    ]);

    const recipients = await findEligibleRecipients({
      userLookupService,
      departmentId: "dept-tech",
      siteId: "site-cariu",
      excludeUserId: "creator-1",
    });

    expect(recipients.map((r) => r.id)).toEqual(["verifier"]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/modules/notification/NotificationService.recipients.test.ts
```

Expected: FAIL — Dede still included (current OR allows users without `workorders:department_only`).

- [ ] **Step 3: Implement tight dept filter**

Rewrite department scoping in `NotificationService.recipients.ts`:

1. Keep SQL/Prisma prefilter broad enough to load candidates (read permission + site), **or** keep current where but **post-filter** in `isEligibleRecipient` / new `isPoolEligibleForDepartment`.

Recommended: **post-filter** after `findManyWithDetailedRelations` so permission resource is accurate:

```typescript
function hasDepartmentOnly(user: EligibleUser): boolean {
  return (
    user.role?.permission?.some(
      (p) =>
        p.action === WORK_ORDER_DEPARTMENT_ONLY_ACTION &&
        (p.resource === WORK_ORDER_RESOURCE ||
          p.resource === WORK_ORDER_MOBILE_RESOURCE),
    ) ?? false
  );
}

function hasVerifyOrApprove(user: EligibleUser): boolean {
  return (
    user.role?.permission?.some(
      (p) =>
        (p.resource === WORK_ORDER_RESOURCE ||
          p.resource === WORK_ORDER_MOBILE_RESOURCE) &&
        (p.action === "verify" || p.action === "approve_request"),
    ) ?? false
  );
}

function isPoolDepartmentAllowed(
  user: EligibleUser,
  departmentId?: string,
): boolean {
  if (!departmentId) return true;
  if (user.departmentId === departmentId) return true;
  if (user.departmentId === null) return true;
  if (hasVerifyOrApprove(user)) return true;
  // If restricted by department_only on either resource → must match dept
  if (hasDepartmentOnly(user)) return false;
  // No department_only → broad-read at site (admin-style)
  return true;
}
```

In `findEligibleRecipients`:

```typescript
return users
  .filter((user: EligibleUser) => isEligibleRecipient(user, input))
  .filter((user: EligibleUser) =>
    isPoolDepartmentAllowed(user, input.departmentId),
  )
  .map(mapRecipientUser);
```

**Remove or neutralize** the leaky Prisma OR branch that treated “no `workorders:department_only`” as cross-dept (the third OR arm in `buildDepartmentScopedConditions`). Prefer simpler where: base read + site; dept handled in post-filter.

Simplified `buildEligibleRecipientWhere` when `departmentId` present:

```typescript
return {
  ...buildEligibleRecipientBaseWhere(input.excludeUserId),
  ...(siteConditions ? { OR: siteConditions } : {}),
};
```

(Dept matching only in post-filter.)

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/modules/notification/NotificationService.recipients.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
GIT_MASTER=1 git add \
  modules/notification/services/NotificationService.recipients.ts \
  tests/modules/notification/NotificationService.recipients.test.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
fix(notification): enforce multi-resource department_only for WO pool

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 3: Add `findWorkOrderStakeholders` + tests

**Files:**
- Modify: `modules/notification/services/NotificationService.recipients.ts`
- Modify: `tests/modules/notification/NotificationService.recipients.test.ts`

**Interfaces:**
- Produces:

```typescript
export async function findWorkOrderStakeholders(input: {
  userLookupService: UserLookupService;
  workOrderId: string;
  siteId?: string;
  departmentId?: string;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
  excludeUserId?: string;
}): Promise<RecipientUser[]>
```

- [ ] **Step 1: Write failing tests**

Append to recipients test file:

```typescript
import { findWorkOrderStakeholders } from "@/modules/notification/services/NotificationService.recipients";

// mock prisma for assignments if used
vi.mock("@/lib/prisma", () => ({
  prisma: {
    work_order_assignments: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("findWorkOrderStakeholders", () => {
  it("includes assignee and creator and excludes actor", async () => {
    findManyWithDetailedRelations.mockResolvedValue([]);
    // if implementation resolves explicit IDs without lookup when only IDs:
    const recipients = await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: "site-cariu",
      assignedToId: "assignee-1",
      createdById: "creator-1",
      excludeUserId: "assignee-1", // actor is assignee
    });
    expect(recipients.map((r) => r.id).sort()).toEqual(["creator-1"]);
  });

  it("includes users with workorders:verify in site", async () => {
    findManyWithCustomWhere.mockResolvedValue([{ id: "verifier-1" }]);
    const recipients = await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: "site-cariu",
      excludeUserId: "actor-1",
    });
    expect(recipients.map((r) => r.id)).toContain("verifier-1");
  });

  it("does not include broad-read technician who is not stakeholder", async () => {
    findManyWithCustomWhere.mockResolvedValue([]);
    findManyWithDetailedRelations.mockResolvedValue([
      user({ id: "random-tech", departmentId: "dept-tech" }),
    ]);
    const recipients = await findWorkOrderStakeholders({
      userLookupService,
      workOrderId: "wo-1",
      siteId: "site-cariu",
      excludeUserId: "actor-1",
    });
    expect(recipients.map((r) => r.id)).not.toContain("random-tech");
  });
});
```

Adjust mocks to match final implementation (use `findManyWithCustomWhere` for verify users).

- [ ] **Step 2: Run — expect FAIL** (function missing)

- [ ] **Step 3: Implement `findWorkOrderStakeholders`**

```typescript
import { prisma } from "@/lib/prisma";

const VERIFY_ACTIONS = ["verify", "approve_request"] as const;

export async function findWorkOrderStakeholders(input: {
  userLookupService: UserLookupService;
  workOrderId: string;
  siteId?: string;
  departmentId?: string;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
  excludeUserId?: string;
}): Promise<RecipientUser[]> {
  const explicitIds = new Set<string>();
  for (const id of [
    input.assignedToId,
    input.createdById,
    input.requestedById,
  ]) {
    if (id) explicitIds.add(id);
  }

  const assignments = await prisma.work_order_assignments.findMany({
    where: { workOrderId: input.workOrderId },
    select: { userId: true },
  });
  for (const row of assignments) {
    if (row.userId) explicitIds.add(row.userId);
  }

  const verifiers = await input.userLookupService.findManyWithCustomWhere({
    isActive: true,
    role: {
      permission: {
        some: {
          OR: [
            { resource: WORK_ORDER_RESOURCE, action: { in: [...VERIFY_ACTIONS] } },
            {
              resource: WORK_ORDER_MOBILE_RESOURCE,
              action: { in: ["verify"] },
            },
          ],
        },
      },
    },
    ...(input.siteId
      ? {
          OR: [
            { siteId: input.siteId },
            { siteId: null },
            { userSites: { some: { siteId: input.siteId } } },
          ],
        }
      : {}),
  });

  for (const v of verifiers) {
    explicitIds.add(v.id);
  }

  if (input.excludeUserId) {
    explicitIds.delete(input.excludeUserId);
  }

  return [...explicitIds].map((id) => ({ id }));
}
```

**Note:** Confirm Prisma model name for assignments (`work_order_assignments` vs `workOrderAssignment`) via schema before coding — use the actual client model.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
GIT_MASTER=1 git add \
  modules/notification/services/NotificationService.recipients.ts \
  tests/modules/notification/NotificationService.recipients.test.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
feat(notification): add findWorkOrderStakeholders for action/status events

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 4: Wire STAKEHOLDERS into status / update / mobile / assign observers

**Files:**
- Modify: `modules/notification/services/NotificationService.types.ts`
- Modify: `modules/notification/services/NotificationService.work-order-events.ts`
- Modify: `modules/notification/services/NotificationService.ts` (mobile action data fields)
- Modify: callers that already have WO entity to pass `createdById` / `requestedById` when cheap:
  - `modules/work-order/services/WorkOrderNotifications.ts`
  - `modules/work-order/services/work-order-side-effects.ts`
  - `modules/work-order/services/mobile-work-order-notification.helpers.ts`
- Test: extend `NotificationService.recipients.test.ts` or add thin event unit test with mocked `findWorkOrderStakeholders`

**Interfaces:**
- Extend `WorkOrderNotificationData`:

```typescript
export interface WorkOrderNotificationData {
  // existing fields...
  createdById?: string | undefined;
  requestedById?: string | undefined;
}
```

- Mobile action data gains optional `assignedToId?`, `createdById?`, `requestedById?`

- [ ] **Step 1: Write failing test for event wiring**

Create `tests/modules/notification/NotificationService.work-order-events.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const findEligibleRecipients = vi.fn();
const findWorkOrderStakeholders = vi.fn();

vi.mock("@/modules/notification/services/NotificationService.recipients", () => ({
  findEligibleRecipients: (...args: unknown[]) =>
    findEligibleRecipients(...args),
  findWorkOrderStakeholders: (...args: unknown[]) =>
    findWorkOrderStakeholders(...args),
}));

const createNotification = vi.fn();
const userLookupService = {} as import("@/modules/users").UserLookupService;

import {
  notifyNewWorkOrderEvent,
  notifyWorkOrderStatusChangeEvent,
  notifyAdminsAboutMobileActionEvent,
} from "@/modules/notification/services/NotificationService.work-order-events";

describe("work-order notification audiences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findEligibleRecipients.mockResolvedValue([{ id: "pool-1" }]);
    findWorkOrderStakeholders.mockResolvedValue([{ id: "stake-1" }]);
    createNotification.mockResolvedValue({});
  });

  it("new WO uses POOL (findEligibleRecipients)", async () => {
    await notifyNewWorkOrderEvent({
      userLookupService,
      createNotification,
      data: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-1",
        title: "T",
        type: "INSTALLATION",
        priority: "NORMAL",
        departmentId: "d1",
        siteId: "s1",
        triggeredByUserId: "u0",
      },
    });
    expect(findEligibleRecipients).toHaveBeenCalled();
    expect(findWorkOrderStakeholders).not.toHaveBeenCalled();
  });

  it("status change uses STAKEHOLDERS", async () => {
    await notifyWorkOrderStatusChangeEvent({
      userLookupService,
      createNotification,
      data: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-1",
        title: "T",
        type: "INSTALLATION",
        priority: "NORMAL",
        oldStatus: "COMPLETED",
        newStatus: "VERIFIED",
        departmentId: "d1",
        siteId: "s1",
        assignedToId: "tech-1",
        createdById: "admin-1",
        triggeredByUserId: "u0",
      },
    });
    expect(findWorkOrderStakeholders).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: "wo-1",
        assignedToId: "tech-1",
        createdById: "admin-1",
        excludeUserId: "u0",
      }),
    );
    expect(findEligibleRecipients).not.toHaveBeenCalled();
  });

  it("mobile action uses STAKEHOLDERS", async () => {
    await notifyAdminsAboutMobileActionEvent({
      userLookupService,
      createNotification,
      data: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-1",
        title: "T",
        actionType: "CLAIM",
        actionMessage: "claim",
        triggeredByUserId: "tech-1",
        departmentId: "d1",
        siteId: "s1",
        assignedToId: "tech-1",
      },
    });
    expect(findWorkOrderStakeholders).toHaveBeenCalled();
    expect(findEligibleRecipients).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — FAIL** (still calls findEligibleRecipients for status/mobile)

- [ ] **Step 3: Wire events**

In `NotificationService.work-order-events.ts`:

- Keep `notifyNewWorkOrderEvent` → `findEligibleRecipients` (POOL).
- Replace `findWorkOrderObservers` usage for status/update/mobile/assign with `findWorkOrderStakeholders`.
- Pass stakeholder fields from `data`.

Example for status:

```typescript
const recipients = await findWorkOrderStakeholders({
  userLookupService: input.userLookupService,
  workOrderId: input.data.workOrderId,
  siteId: input.data.siteId,
  departmentId: input.data.departmentId,
  assignedToId: input.data.assignedToId,
  createdById: input.data.createdById,
  requestedById: input.data.requestedById,
  excludeUserId: input.data.triggeredByUserId,
});
```

For assigned observers: stakeholders with `excludeUserId: data.assignedToId` (assignee gets dedicated notification separately).

Extend mobile action `data` type + `notifyAdminsAboutMobileAction` signature with optional IDs; update `buildNotificationScope` / helpers to include `assignedToId`, `createdById` from WO detail when present.

- [ ] **Step 4: Run event tests — PASS**

```bash
npx vitest run tests/modules/notification/NotificationService.work-order-events.test.ts tests/modules/notification/NotificationService.recipients.test.ts
```

- [ ] **Step 5: Commit**

```bash
GIT_MASTER=1 git add \
  modules/notification/services/NotificationService.types.ts \
  modules/notification/services/NotificationService.work-order-events.ts \
  modules/notification/services/NotificationService.ts \
  modules/work-order/services/WorkOrderNotifications.ts \
  modules/work-order/services/work-order-side-effects.ts \
  modules/work-order/services/mobile-work-order-notification.helpers.ts \
  tests/modules/notification/NotificationService.work-order-events.test.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
fix(notification): route WO status/mobile events to stakeholders only

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 5: Stop double in-app notify on WORK_ORDER_CREATED

**Files:**
- Modify: `lib/event-bus/event-handlers.ts` (lines ~258–298)
- Create: `tests/modules/notification/event-handlers/work-order-created.handler.test.ts`  
  OR unit-test the handler body via extracting a small function if import is heavy — prefer mocking dynamic imports.

**Primary create path (keep in-app):**
- `WorkOrderMutationService` → `notifyWorkOrderCreatedSafely` → `onWorkOrderCreated` → `notifyNewWorkOrder`
- Also: `MixRadiusDismantleNotificationService` → `onWorkOrderCreated` (keep)

**Event bus path (socket only):**
- Remove `notifyNewWorkOrder` import and call.

- [ ] **Step 1: Write failing test**

If full worker registration is hard to unit-test, add a focused regression test:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("WORK_ORDER_CREATED handler", () => {
  it("does not call notifyNewWorkOrder (in-app is sync path only)", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/event-bus/event-handlers.ts"),
      "utf8",
    );
    const createdBlock = source.slice(
      source.indexOf("WORK_ORDER_CREATED"),
      source.indexOf("WORK_ORDER_UPDATED"),
    );
    expect(createdBlock).toContain("socketEmitter.newWorkOrder");
    expect(createdBlock).not.toContain("notifyNewWorkOrder");
  });
});
```

(Contract-style test matching existing admin-notification-contract pattern.)

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Edit handler**

```typescript
registerEventHandler(EVENT_NAMES.WORK_ORDER_CREATED, async (job) => {
  const { payload } = job.data;
  try {
    const { socketEmitter } = await import("@/lib/websocket/emitter");
    socketEmitter.newWorkOrder(
      {
        id: payload.workOrderId,
        workOrderNumber: payload.workOrderNumber,
        title: payload.title,
        type: payload.type,
        status: "OPEN",
        priority: payload.priority,
        assignedToId: payload.assignedToId ?? null,
        departmentId: payload.departmentId ?? null,
      },
      payload.departmentId,
      payload.siteId,
    );
    // In-app + WA: only via notifyWorkOrderCreatedSafely / onWorkOrderCreated
  } catch (error) {
    logger.error("[Worker] Work order created handler error:", error);
    throw error;
  }
});
```

- [ ] **Step 4: Run contract test — PASS**

- [ ] **Step 5: Audit call sites**

Confirm every create path that needs in-app notif still calls `notifyWorkOrderCreatedSafely` or `onWorkOrderCreated`:

```bash
rg -n "publishWorkOrderCreatedEvent|notifyWorkOrderCreatedSafely|onWorkOrderCreated" modules --glob "*.ts"
```

If any path only publishes the event, add `notifyWorkOrderCreatedSafely` there.

- [ ] **Step 6: Commit**

```bash
GIT_MASTER=1 git add \
  lib/event-bus/event-handlers.ts \
  tests/modules/notification/event-handlers/work-order-created.handler.test.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
fix(notification): stop double Work Order Baru from event bus

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 6: Changelog + full test pass

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Add Unreleased entry**

```markdown
### [2026-07-21] — Fix audience notifikasi work order (stop spam cross-dept)

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`, `lib/event-bus`, `modules/work-order`
- **Author**: agent
- **Deskripsi**: Penerima notifikasi WO dipisah POOL (WO baru, dept+site ketat
  dengan `department_only` di workorders/m_work_order) vs STAKEHOLDERS (status,
  aksi mobile, assign observer). Event bus WORK_ORDER_CREATED hanya realtime
  socket agar tidak double-fire "Work Order Baru".
- **Files**: `NotificationService.recipients.ts`,
  `NotificationService.work-order-events.ts`, `event-handlers.ts`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 2: Run related tests**

```bash
npx vitest run tests/modules/notification/
```

Expected: all pass (or only pre-existing failures noted).

- [ ] **Step 3: Commit**

```bash
GIT_MASTER=1 git add docs/CHANGELOG.md
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
docs(changelog): catat fix audience notifikasi work order

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 7: Manual verification checklist (post-deploy)

Not code — run after production deploy:

1. Create WO Technical site CARIU → teknisi Technical get **one** “Work Order Baru”; Dede Operations does **not**.
2. Teknisi claim + take inventory → Dede does **not** get mobile action notifs.
3. Status COMPLETED → VERIFIED → only assignee/creator/verifiers; not BM Operations without verify.
4. Super Admin / verifier still receives status/mobile actions for site.
5. Badge may still be high historically (expected — no purge).

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Multi-resource `department_only` | Task 2 |
| POOL for new WO | Task 2 + 4 |
| STAKEHOLDERS for status/mobile/update/assign observers | Task 3 + 4 |
| Single publisher for in-app new WO | Task 5 |
| No historical purge | Task 6 non-goal |
| Tests Dede vs Teknisi fixtures | Task 2–4 |
| Changelog | Task 6 |
| Expand permission select for post-filter | Task 1 |

## Placeholder scan

No TBD remaining. Prisma assignment model name must be confirmed at implement time against `prisma/schema.prisma` (step in Task 3).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-work-order-notification-audience.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session via executing-plans with checkpoints  

Which approach?
