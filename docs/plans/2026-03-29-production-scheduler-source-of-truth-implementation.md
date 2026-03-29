# Production Scheduler Source of Truth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the dedicated cron pod the only production and staging scheduler, while preventing app pods from starting `cronRegistry`.

**Architecture:** Add a small runtime gate for internal cron startup, apply it consistently in all Node entrypoints, and explicitly disable internal cron in staging/production app deployments. Then harden the HTTP cron routes with execution locks so the system remains safe even if a route is triggered twice.

**Tech Stack:** Next.js, TypeScript, Vitest, Kubernetes manifests, Redis-based cron locking

---

### Task 1: Add internal cron startup gate helper

**Files:**
- Create: `lib/runtime/should-start-internal-cron.ts`
- Test: `tests/lib/runtime/should-start-internal-cron.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { shouldStartInternalCron } from '@/lib/runtime/should-start-internal-cron'

describe('shouldStartInternalCron', () => {
  it('returns false when ENABLE_INTERNAL_CRON is false', () => {
    expect(shouldStartInternalCron({ ENABLE_INTERNAL_CRON: 'false' })).toBe(false)
  })

  it('returns true when ENABLE_INTERNAL_CRON is true', () => {
    expect(shouldStartInternalCron({ ENABLE_INTERNAL_CRON: 'true' })).toBe(true)
  })

  it('defaults to true when the flag is unset', () => {
    expect(shouldStartInternalCron({})).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/lib/runtime/should-start-internal-cron.test.ts`
Expected: FAIL because the helper file does not exist yet.

**Step 3: Write minimal implementation**

```ts
type EnvShape = Record<string, string | undefined>

export function shouldStartInternalCron(env: EnvShape = process.env): boolean {
  const flag = env.ENABLE_INTERNAL_CRON?.trim().toLowerCase()

  if (flag === 'true') return true
  if (flag === 'false') return false

  return true
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/lib/runtime/should-start-internal-cron.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/runtime/should-start-internal-cron.ts tests/lib/runtime/should-start-internal-cron.test.ts
git commit -m "refactor: add internal cron startup gate"
```

### Task 2: Gate internal cron startup in all runtime entrypoints

**Files:**
- Modify: `server.ts`
- Modify: `server-api.ts`
- Modify: `worker.ts`
- Modify: `tests/lib/runtime/should-start-internal-cron.test.ts`

**Step 1: Write the failing test**

Add assertions that the helper is the single decision point used by the runtime entrypoints, for example by testing a small wrapper function or extracted startup utility:

```ts
it('skips cron startup when the helper returns false', async () => {
  const startAll = vi.fn()
  const shouldStart = vi.fn(() => false)

  await maybeStartInternalCron({ shouldStart, startAll })

  expect(startAll).not.toHaveBeenCalled()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/lib/runtime/should-start-internal-cron.test.ts`
Expected: FAIL because the runtime wrapper or entrypoint integration is missing.

**Step 3: Write minimal implementation**

Apply the helper at each startup point:

```ts
if (shouldStartInternalCron()) {
  cronRegistry.startAll()
} else {
  console.log('[Cron] Internal cron disabled for this runtime')
}
```

Use the same gate in:

- `server.ts`
- `server-api.ts`
- `worker.ts`

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/lib/runtime/should-start-internal-cron.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add server.ts server-api.ts worker.ts tests/lib/runtime/should-start-internal-cron.test.ts
git commit -m "refactor: gate internal cron startup"
```

### Task 3: Disable internal cron in staging and production app pods

**Files:**
- Modify: `k8s/production/app-deployment.yaml`
- Modify: `k8s/staging/app-deployment.yaml`

**Step 1: Write the failing test**

Create a small manifest-level regression test or snapshot test:

```ts
import { readFileSync } from 'node:fs'

it('production app deployment disables internal cron', () => {
  const yaml = readFileSync('k8s/production/app-deployment.yaml', 'utf8')
  expect(yaml).toContain('name: ENABLE_INTERNAL_CRON')
  expect(yaml).toContain('value: "false"')
})
```

Mirror the same assertion for staging in `tests/k8s/app-deployment-cron-config.test.ts`.

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/k8s/app-deployment-cron-config.test.ts`
Expected: FAIL because the env var is not in the manifests yet.

**Step 3: Write minimal implementation**

Add this environment entry to both app deployment manifests:

```yaml
- name: ENABLE_INTERNAL_CRON
  value: "false"
```

Do not add it to the cron deployment, because the cron image does not boot `cronRegistry`.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/k8s/app-deployment-cron-config.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add k8s/production/app-deployment.yaml k8s/staging/app-deployment.yaml tests/k8s/app-deployment-cron-config.test.ts
git commit -m "chore: disable internal cron in app deployments"
```

### Task 4: Add execution locks to HTTP cron routes

**Files:**
- Modify: `app/api/cron/auto-checkout/route.ts`
- Modify: `app/api/cron/process-absence/route.ts`
- Modify: `app/api/cron/attendance-alert/route.ts`
- Modify: `tests/api/attendance-cron-route.test.ts`
- Create: `tests/api/auto-checkout-route.test.ts`
- Create: `tests/api/attendance-alert-route.test.ts`

**Step 1: Write the failing test**

Add route tests that prove a duplicate call is rejected or safely short-circuited when the lock is not acquired:

```ts
it('returns a skip response when auto-checkout lock is already held', async () => {
  acquireCronLock.mockResolvedValue(false)

  const response = await GET(request)
  const json = await response.json()

  expect(response.status).toBe(200)
  expect(json.skipped).toBe(true)
})
```

Mirror the same pattern for `process-absence` and `attendance-alert`.

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/api/auto-checkout-route.test.ts tests/api/attendance-alert-route.test.ts tests/api/attendance-cron-route.test.ts`
Expected: FAIL because the routes do not acquire execution locks yet.

**Step 3: Write minimal implementation**

Use `acquireCronLock(...)` near the route boundary:

```ts
const acquired = await acquireCronLock('processAbsenceRoute', 55 * 60)
if (!acquired) {
  return apiSuccess({ skipped: true, reason: 'Lock already held' })
}
```

Choose distinct lock keys per route and align TTL with the job cadence.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/api/auto-checkout-route.test.ts tests/api/attendance-alert-route.test.ts tests/api/attendance-cron-route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/cron/auto-checkout/route.ts app/api/cron/process-absence/route.ts app/api/cron/attendance-alert/route.ts tests/api/attendance-cron-route.test.ts tests/api/auto-checkout-route.test.ts tests/api/attendance-alert-route.test.ts
git commit -m "fix: add execution locks to cron routes"
```

### Task 5: Verify scheduler consolidation end to end

**Files:**
- Modify: `docs/plans/2026-03-29-production-scheduler-source-of-truth-design.md`
- Modify: `docs/plans/2026-03-29-production-scheduler-source-of-truth-implementation.md`

**Step 1: Write the failing test**

No new failing unit test is required for this step. Treat verification commands as the regression gate.

**Step 2: Run test to verify the integrated change**

Run:

```bash
npm run test:run -- tests/lib/runtime/should-start-internal-cron.test.ts tests/k8s/app-deployment-cron-config.test.ts tests/api/attendance-cron-route.test.ts tests/api/auto-checkout-route.test.ts tests/api/attendance-alert-route.test.ts tests/modules/attendance/AttendanceAlertService.test.ts
```

Expected: PASS.

**Step 3: Run static and build verification**

Run:

```bash
npm run typecheck
npm run build
```

Expected: PASS.

**Step 4: Update docs if verification changes the design detail**

Document any final naming or lock-key adjustments in the two plan files.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-29-production-scheduler-source-of-truth-design.md docs/plans/2026-03-29-production-scheduler-source-of-truth-implementation.md lib/runtime/should-start-internal-cron.ts tests/lib/runtime/should-start-internal-cron.test.ts server.ts server-api.ts worker.ts k8s/production/app-deployment.yaml k8s/staging/app-deployment.yaml app/api/cron/auto-checkout/route.ts app/api/cron/process-absence/route.ts app/api/cron/attendance-alert/route.ts tests/k8s/app-deployment-cron-config.test.ts tests/api/attendance-cron-route.test.ts tests/api/auto-checkout-route.test.ts tests/api/attendance-alert-route.test.ts
git commit -m "refactor: consolidate production scheduler ownership"
```
