# Attendance Auto-Checkout Grace Period Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make attendance auto-checkout eligible exactly 3 hours after the tenant-local work/shift end time, while preserving FLEXIBLE 24-hour stale behavior and fixing misleading tests.

**Architecture:** Keep the rule centralized in `AttendanceSessionPolicyService` because both cron scanning and next-day check-in cleanup call this policy. Pass the tenant timezone into the policy from callers that already know tenant context, then compute schedule end dates using `date-fns-tz` instead of process-local `Date#setHours`. Keep BullMQ payload validation unchanged; it will naturally compare against the timezone-correct `expectedAutoCheckoutAt`.

**Tech Stack:** TypeScript, Vitest, Prisma `AttendanceStatus`, `date-fns-tz`, existing attendance module services/repositories, BullMQ auto-checkout queue.

---

## File Structure

**Modify:** `modules/attendance/services/AttendanceSessionPolicyService.ts`
- Add optional `timezone?: string` to `AttendanceSessionPolicyInput`.
- Replace process-local `setHours`/`setDate` schedule calculations with tenant-local timezone calculations.
- Compare shift times by total minutes so overnight detection handles same-hour minute cases.
- Keep `AUTO_CHECKOUT_GRACE_HOURS` applied after the resolved scheduled checkout time.
- Change FLEXIBLE stale check from `>` to `>=`.

**Modify:** `modules/attendance/services/AutoCheckoutService.ts`
- Pass the tenant timezone already loaded in `runTenantAutoCheckout()` into `AttendanceSessionPolicyService.resolve()`.
- Load and pass timezone in `runAutoCheckoutJob()` using `data.tenantId`, because worker execution recomputes and validates the expected timestamp independently.

**Modify:** `modules/attendance/services/AttendanceService.ts`
- Pass the check-in timezone (`tz`) into `processAutoCheckout()`.
- Add `timezone` to `processAutoCheckout()` parameters and forward it into `AttendanceSessionPolicyService.resolve()` so next-day check-in cleanup follows the same tenant-local rule.

**Modify:** `modules/attendance/utils/constants.ts`
- Keep `AUTO_CHECKOUT_GRACE_HOURS: 3` as the single named constant for the grace period.

**Modify:** `tests/modules/attendance/AttendanceSessionPolicyService.test.ts`
- Add tests for timezone-aware fixed/shift schedule calculations.
- Add tests for overnight same-hour minute comparison.
- Add test for overnight shift eligibility exactly 3 hours after shift end.
- Add test for FLEXIBLE stale exactly at 24 hours.

**Modify:** `tests/modules/attendance/AutoCheckoutService.test.ts`
- Fix the misleading concurrent update test to use the new canonical `expectedAutoCheckoutAt`.
- Add/adjust worker test to prove `runAutoCheckoutJob()` uses tenant timezone when validating `expectedAutoCheckoutAt`.

**Modify:** `tests/modules/attendance/AutoCheckoutParity.test.ts`
- If parity expectations shift due to timezone injection, adjust expected payloads while keeping the test focused on inline-vs-queued consistency.

---

### Task 1: Add RED policy tests for timezone, minute-based overnight, overnight +3h, and FLEXIBLE >=24h

**Files:**
- Modify: `tests/modules/attendance/AttendanceSessionPolicyService.test.ts`

- [ ] **Step 1: Add failing tests to policy test file**

Append these tests inside the existing `describe('AttendanceSessionPolicyService', () => { ... })` block, before the final closing `})`:

```ts
  it('uses tenant timezone when resolving fixed-hour auto-checkout grace period', async () => {
    const { AttendanceSessionPolicyService } = await import('@/modules/attendance/services/AttendanceSessionPolicyService')
    const service = new AttendanceSessionPolicyService()

    const attendance: AttendanceSessionPolicyInput['attendance'] = {
      id: 'att-fixed-jakarta',
      checkIn: new Date('2026-03-27T01:00:00.000Z'),
      checkOut: null,
      status: 'ON_TIME',
      user: {
        workingHourMode: 'FIXED',
        flexibleTargetHour: null,
        shift: null,
      },
    }

    const atWorkEnd = service.resolve({
      attendance,
      now: new Date('2026-03-27T10:00:00.000Z'),
      scheduleEndTime: '17:00',
      timezone: 'Asia/Jakarta',
    })

    const afterGracePeriod = service.resolve({
      attendance,
      now: new Date('2026-03-27T13:00:00.000Z'),
      scheduleEndTime: '17:00',
      timezone: 'Asia/Jakarta',
    })

    expect(atWorkEnd.reason).toBe('same-day-open')
    expect(atWorkEnd.shouldAutoCheckout).toBe(false)
    expect(afterGracePeriod.reason).toBe('eligible-for-auto-checkout')
    expect(afterGracePeriod.autoCheckoutAt?.toISOString()).toBe('2026-03-27T13:00:00.000Z')
    expect(afterGracePeriod.nextStatus).toBe('NO_CHECKOUT')
  })

  it('treats same-hour earlier end minute as overnight shift', async () => {
    const { AttendanceSessionPolicyService } = await import('@/modules/attendance/services/AttendanceSessionPolicyService')
    const service = new AttendanceSessionPolicyService()

    const decision = service.resolve({
      attendance: {
        id: 'att-same-hour-overnight',
        checkIn: new Date('2026-03-27T16:30:00.000Z'),
        checkOut: null,
        status: 'ON_TIME',
        user: {
          workingHourMode: 'SHIFT',
          flexibleTargetHour: null,
          shift: {
            startTime: '23:30',
            endTime: '23:15',
          },
        },
      },
      now: new Date('2026-03-28T13:00:00.000Z'),
      timezone: 'Asia/Jakarta',
    })

    expect(decision.reason).toBe('overnight-shift-active')
    expect(decision.shouldAutoCheckout).toBe(false)
  })

  it('waits three hours after overnight shift end before auto-checkout', async () => {
    const { AttendanceSessionPolicyService } = await import('@/modules/attendance/services/AttendanceSessionPolicyService')
    const service = new AttendanceSessionPolicyService()

    const attendance: AttendanceSessionPolicyInput['attendance'] = {
      id: 'att-overnight-grace',
      checkIn: new Date('2026-03-27T14:00:00.000Z'),
      checkOut: null,
      status: 'ON_TIME',
      user: {
        workingHourMode: 'SHIFT',
        flexibleTargetHour: null,
        shift: {
          startTime: '21:00',
          endTime: '04:00',
        },
      },
    }

    const atShiftEnd = service.resolve({
      attendance,
      now: new Date('2026-03-27T21:00:00.000Z'),
      timezone: 'Asia/Jakarta',
    })

    const afterGracePeriod = service.resolve({
      attendance,
      now: new Date('2026-03-28T00:00:00.000Z'),
      timezone: 'Asia/Jakarta',
    })

    expect(atShiftEnd.reason).toBe('same-day-open')
    expect(atShiftEnd.shouldAutoCheckout).toBe(false)
    expect(afterGracePeriod.reason).toBe('eligible-for-auto-checkout')
    expect(afterGracePeriod.autoCheckoutAt?.toISOString()).toBe('2026-03-28T00:00:00.000Z')
    expect(afterGracePeriod.nextStatus).toBe('NO_CHECKOUT')
  })

  it('marks flexible sessions stale exactly at twenty four hours', async () => {
    const { AttendanceSessionPolicyService } = await import('@/modules/attendance/services/AttendanceSessionPolicyService')
    const service = new AttendanceSessionPolicyService()

    const decision = service.resolve({
      attendance: {
        id: 'att-flex-exact-threshold',
        checkIn: new Date('2026-03-27T01:00:00.000Z'),
        checkOut: null,
        status: 'ON_TIME',
        user: {
          workingHourMode: 'FLEXIBLE',
          flexibleTargetHour: 8,
          shift: null,
        },
      },
      now: new Date('2026-03-28T01:00:00.000Z'),
    })

    expect(decision.reason).toBe('stale-flexible-session')
    expect(decision.shouldAutoCheckout).toBe(true)
    expect(decision.autoCheckoutAt?.toISOString()).toBe('2026-03-28T01:00:00.000Z')
    expect(decision.nextStatus).toBe('ON_TIME')
  })
```

- [ ] **Step 2: Run RED policy tests**

Run:

```bash
npm test -- --run tests/modules/attendance/AttendanceSessionPolicyService.test.ts
```

Expected before implementation:
- Test file fails.
- At least these failures occur:
  - `timezone` is not accepted by `AttendanceSessionPolicyInput`, or timezone-aware expectation fails.
  - same-hour overnight test returns `same-day-open` / wrong reason instead of `overnight-shift-active`.
  - overnight +3h test returns wrong `autoCheckoutAt` or eligibility.
  - FLEXIBLE exact threshold returns `same-day-open` because current code uses `>`.

---

### Task 2: Implement timezone-aware schedule calculation and policy fixes

**Files:**
- Modify: `modules/attendance/services/AttendanceSessionPolicyService.ts`

- [ ] **Step 1: Update imports and input type**

Change the top of `modules/attendance/services/AttendanceSessionPolicyService.ts` from:

```ts
import type { AttendanceStatus } from "@prisma/client";

import { ATTENDANCE_CONSTANTS } from "../utils/constants";
```

To:

```ts
import type { AttendanceStatus } from "@prisma/client";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { ATTENDANCE_CONSTANTS } from "../utils/constants";
```

Then update `AttendanceSessionPolicyInput` from:

```ts
  now: Date;
  scheduleEndTime?: string | null;
```

To:

```ts
  now: Date;
  scheduleEndTime?: string | null;
  timezone?: string;
```

- [ ] **Step 2: Replace local-time helper functions**

Replace the current `buildDefaultCheckout()` and `getOvernightShiftEnd()` helper section with:

```ts
function parseTimeParts(time: string | null | undefined): {
  hours: number;
  minutes: number;
} | null {
  if (!time) {
    return null;
  }

  const [hours, minutes = 0] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return { hours, minutes };
}

function getTotalMinutes(time: string | null | undefined): number | null {
  const parts = parseTimeParts(time);
  if (!parts) {
    return null;
  }

  return parts.hours * 60 + parts.minutes;
}

function buildTenantLocalDateTime(params: {
  anchor: Date;
  time: string;
  timezone: string;
  addDays?: number;
}): Date {
  const { anchor, time, timezone, addDays = 0 } = params;
  const parts = parseTimeParts(time);
  const localAnchor = toZonedTime(anchor, timezone);

  if (!parts) {
    return new Date(anchor);
  }

  localAnchor.setDate(localAnchor.getDate() + addDays);
  localAnchor.setHours(parts.hours, parts.minutes, 0, 0);

  return fromZonedTime(localAnchor, timezone);
}

function buildDefaultCheckout(
  checkIn: Date,
  scheduleEndTime: string | null | undefined,
  timezone: string,
): Date {
  const checkoutAt = buildTenantLocalDateTime({
    anchor: checkIn,
    time: scheduleEndTime ?? `${ATTENDANCE_CONSTANTS.END_OF_DAY_HOUR}:00`,
    timezone,
  });

  if (checkoutAt <= checkIn) {
    return new Date(
      checkIn.getTime() +
        ATTENDANCE_CONSTANTS.DEFAULT_WORK_HOURS * 60 * 60 * 1000,
    );
  }

  return checkoutAt;
}

function addAutoCheckoutGracePeriod(checkoutAt: Date): Date {
  return new Date(
    checkoutAt.getTime() +
      ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_GRACE_HOURS * 60 * 60 * 1000,
  );
}

function getOvernightShiftEnd(
  checkIn: Date,
  startTime: string | null,
  endTime: string | null,
  timezone: string,
): Date | null {
  const startMinutes = getTotalMinutes(startTime);
  const endMinutes = getTotalMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  if (endMinutes >= startMinutes) {
    return null;
  }

  return buildTenantLocalDateTime({
    anchor: checkIn,
    time: endTime!,
    timezone,
    addDays: 1,
  });
}
```

- [ ] **Step 3: Update `resolve()` to use timezone and `>=` flexible threshold**

Inside `resolve()`, change:

```ts
    const { attendance, now, scheduleEndTime } = input;
```

To:

```ts
    const { attendance, now, scheduleEndTime } = input;
    const timezone = input.timezone ?? process.env.TZ ?? "Asia/Jakarta";
```

Change FLEXIBLE stale check from:

```ts
      const isStale = now > threshold;
```

To:

```ts
      const isStale = now >= threshold;
```

Change `getOvernightShiftEnd()` call from:

```ts
    const overnightShiftEnd = getOvernightShiftEnd(
      attendance.checkIn,
      attendance.user?.shift?.startTime ?? null,
      attendance.user?.shift?.endTime ?? null,
    );
```

To:

```ts
    const overnightShiftEnd = getOvernightShiftEnd(
      attendance.checkIn,
      attendance.user?.shift?.startTime ?? null,
      attendance.user?.shift?.endTime ?? null,
      timezone,
    );
```

Change `buildDefaultCheckout()` call from:

```ts
      buildDefaultCheckout(attendance.checkIn, resolvedScheduleEndTime);
```

To:

```ts
      buildDefaultCheckout(attendance.checkIn, resolvedScheduleEndTime, timezone);
```

- [ ] **Step 4: Run policy tests for GREEN**

Run:

```bash
npm test -- --run tests/modules/attendance/AttendanceSessionPolicyService.test.ts
```

Expected:
- 1 test file passed.
- All policy tests passed.

---

### Task 3: Pass tenant timezone from auto-checkout service and worker validation

**Files:**
- Modify: `modules/attendance/services/AutoCheckoutService.ts`
- Test: `tests/modules/attendance/AutoCheckoutService.test.ts`

- [ ] **Step 1: Write/adjust failing worker timezone test**

In `tests/modules/attendance/AutoCheckoutService.test.ts`, add this test inside `describe("AutoCheckoutService semantics", () => { ... })` after the existing `writes the canonical auto-checkout note from worker execution` test:

```ts
  it("validates worker auto-checkout timestamp using tenant timezone", async () => {
    vi.mocked(getTimezone).mockResolvedValueOnce("Asia/Jakarta");
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-jakarta-worker",
      tenantId: "tenant-jakarta",
      checkIn: new Date("2026-03-27T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      notes: null,
      user: {
        name: "Jakarta Worker",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    } as never);

    await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-jakarta-worker",
      tenantId: "tenant-jakarta",
      mode: "FIXED",
      expectedAutoCheckoutAt: "2026-03-27T13:00:00.000Z",
      sourceCheckInDate: "2026-03-27",
    });

    expect(getTimezone).toHaveBeenCalledWith("tenant-jakarta");
    expect(prismaMock.attendance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "att-jakarta-worker",
          tenantId: "tenant-jakarta",
        }),
        data: expect.objectContaining({
          checkOut: new Date("2026-03-27T13:00:00.000Z"),
          status: "NO_CHECKOUT",
        }),
      }),
    );
  })
```

Also fix the existing concurrent update test payload from:

```ts
      expectedAutoCheckoutAt: "2026-03-27T10:00:00.000Z",
```

To:

```ts
      expectedAutoCheckoutAt: "2026-03-27T13:00:00.000Z",
```

- [ ] **Step 2: Run RED worker test**

Run:

```bash
npm test -- --run tests/modules/attendance/AutoCheckoutService.test.ts
```

Expected before implementation:
- Test fails because `runAutoCheckoutJob()` does not call `getTimezone(data.tenantId)` and does not pass timezone into policy resolve.

- [ ] **Step 3: Update `AutoCheckoutService.runTenantAutoCheckout()` to pass timezone**

In `modules/attendance/services/AutoCheckoutService.ts`, find the `sessionPolicyService.resolve({ ... })` call in `runTenantAutoCheckout()` and add `timezone` beside `now` and `scheduleEndTime`:

```ts
          const decision = sessionPolicyService.resolve({
            attendance: {
              id: attendance.id,
              checkIn: attendance.checkIn,
              checkOut: attendance.checkOut,
              status: attendance.status,
              user: {
                workingHourMode: user.workingHourMode as
                  | "FIXED"
                  | "SHIFT"
                  | "FLEXIBLE"
                  | null,
                flexibleTargetHour: null,
                shift: user.shift
                  ? {
                      startTime: user.shift.startTime,
                      endTime: user.shift.endTime,
                    }
                  : null,
              },
            },
            now,
            scheduleEndTime,
            timezone,
          });
```

- [ ] **Step 4: Update `AutoCheckoutService.runAutoCheckoutJob()` to load and pass timezone**

In `modules/attendance/services/AutoCheckoutService.ts`, inside `static async runAutoCheckoutJob(data: AttendanceAutoCheckoutJobData)`, add timezone after service creation:

```ts
    const timezone = await getTimezone(data.tenantId);
```

Then add `timezone` to the `sessionPolicyService.resolve({ ... })` call:

```ts
      now: new Date(),
      scheduleEndTime,
      timezone,
```

- [ ] **Step 5: Run worker tests for GREEN**

Run:

```bash
npm test -- --run tests/modules/attendance/AutoCheckoutService.test.ts
```

Expected:
- 1 test file passed.
- All AutoCheckoutService tests passed.

---

### Task 4: Pass timezone from next-day check-in stale-session cleanup

**Files:**
- Modify: `modules/attendance/services/AttendanceService.ts`
- Test: `tests/modules/attendance/AutoCheckoutParity.test.ts`

- [ ] **Step 1: Update `processAutoCheckout()` signature and call site**

In `modules/attendance/services/AttendanceService.ts`, change the check-in call from:

```ts
    await this.processAutoCheckout(
      userId,
      userDetails,
      effectiveToday,
      tenantId,
    );
```

To:

```ts
    await this.processAutoCheckout(
      userId,
      userDetails,
      effectiveToday,
      tenantId,
      tz,
    );
```

Then change the private method signature from:

```ts
  private async processAutoCheckout(
    userId: string,
    userDetails: {
      endWorkTime: string | null;
      workingHourMode: string | null;
      shift?: { startTime: string; endTime: string } | null;
    } | null,
    effectiveToday: Date,
    tenantId?: string,
  ) {
```

To:

```ts
  private async processAutoCheckout(
    userId: string,
    userDetails: {
      endWorkTime: string | null;
      workingHourMode: string | null;
      shift?: { startTime: string; endTime: string } | null;
    } | null,
    effectiveToday: Date,
    tenantId: string | undefined,
    timezone: string,
  ) {
```

- [ ] **Step 2: Pass timezone to policy resolve in `processAutoCheckout()`**

In the `sessionPolicyService.resolve({ ... })` call inside `processAutoCheckout()`, add:

```ts
            timezone,
```

The end of the call should look like:

```ts
            now: new Date(),
            scheduleEndTime: this.getScheduleEndTimeForPolicy(
              userDetails?.workingHourMode,
              userDetails,
              userDetails?.shift,
            ),
            timezone,
          });
```

- [ ] **Step 3: Run parity test**

Run:

```bash
npm test -- --run tests/modules/attendance/AutoCheckoutParity.test.ts
```

Expected:
- 1 test file passed.
- Existing parity expectation remains valid or only expected payload timestamp changes to the canonical timezone-aware +3h value.

---

### Task 5: Run full focused verification and review diff

**Files:**
- Verify only; no planned file edits.

- [ ] **Step 1: Run focused attendance auto-checkout tests**

Run:

```bash
npm test -- --run tests/modules/attendance/AttendanceSessionPolicyService.test.ts tests/modules/attendance/AutoCheckoutService.test.ts tests/modules/attendance/AutoCheckoutParity.test.ts
```

Expected:
- 3 test files passed.
- All tests in those files passed.

- [ ] **Step 2: Check IDE diagnostics**

Run diagnostics using the IDE diagnostics tool.

Expected:
- No diagnostics in:
  - `modules/attendance/services/AttendanceSessionPolicyService.ts`
  - `modules/attendance/services/AutoCheckoutService.ts`
  - `modules/attendance/services/AttendanceService.ts`
  - `tests/modules/attendance/AttendanceSessionPolicyService.test.ts`
  - `tests/modules/attendance/AutoCheckoutService.test.ts`
  - `tests/modules/attendance/AutoCheckoutParity.test.ts`

- [ ] **Step 3: Review relevant diff only**

Run:

```bash
git diff -- modules/attendance/services/AttendanceSessionPolicyService.ts modules/attendance/services/AutoCheckoutService.ts modules/attendance/services/AttendanceService.ts modules/attendance/utils/constants.ts tests/modules/attendance/AttendanceSessionPolicyService.test.ts tests/modules/attendance/AutoCheckoutService.test.ts tests/modules/attendance/AutoCheckoutParity.test.ts
```

Expected:
- Diff only includes auto-checkout behavior and tests.
- No unrelated settings/backup/next config changes are mixed into this fix.

- [ ] **Step 4: Request code review**

Dispatch `superpowers:code-reviewer` with this context:

```text
Review the attendance auto-checkout grace period fix. Requirement: FIXED/SHIFT auto-checkout must be eligible exactly 3 hours after tenant-local work/shift end. FLEXIBLE remains stale at >=24 hours. Overnight shift must wait until tenant-local shift end + 3 hours. Check timezone handling, BullMQ expectedAutoCheckoutAt validation, next-day check-in stale cleanup, and tests.
```

Expected:
- No Critical or Important issues remain.
- If reviewer reports valid Critical/Important issues, fix them with a new RED/GREEN test cycle before finalizing.

---

## Self-Review

**Spec coverage:**
- Timezone-aware calculation: Task 1 adds RED test, Task 2 implements timezone-aware helpers, Task 3/4 pass timezone from all known callers.
- Overnight minute comparison: Task 1 adds same-hour minute overnight test, Task 2 implements total-minute comparison.
- FLEXIBLE `>= 24 jam`: Task 1 adds exact-threshold test, Task 2 changes comparison.
- Misleading AutoCheckoutService test: Task 3 fixes the payload to `13:00:00.000Z`.
- Overnight +3h coverage: Task 1 adds explicit overnight shift end +3h test.

**Placeholder scan:**
- No TBD/TODO/fill-in placeholders.
- Every code step includes exact code snippets and exact file paths.
- Every verification step includes exact commands and expected results.

**Type consistency:**
- `AttendanceSessionPolicyInput.timezone?: string` is introduced before callers pass `timezone`.
- `AutoCheckoutService` already imports `getTimezone`, so worker timezone loading uses an existing dependency.
- `AttendanceService.checkIn()` already has `tz`, so stale cleanup can pass it without new external dependency.
