# Attendance Geofence Policy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-user attendance geofence policy with `STRICT`, `WARN`, and `DISABLED` modes so WFO, hybrid, and WFH users can follow different attendance enforcement rules.

**Architecture:** Add a new enum-backed field on `User`, expose the resolved policy through the mobile geofence endpoint, enforce the policy in the backend attendance service, and update the mobile attendance screen to block, warn, or ignore geofence based on that policy. Keep backend as the source of truth and use tests to lock the behavior.

**Tech Stack:** Prisma, Next.js App Router, TypeScript, React Native Expo, TanStack Query, Vitest, Jest

---

### Task 1: Add geofence policy to the data model

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Test: `tests/modules/attendance/GeofenceService.test.ts`

**Step 1: Write the failing test**

Add a backend unit test that creates or mocks a user without `attendanceGeofencePolicy` handling and asserts the model/service contract needs a default `WARN` policy.

```ts
it('defaults attendance geofence policy to WARN', async () => {
  const user = { attendanceGeofencePolicy: 'WARN' }
  expect(user.attendanceGeofencePolicy).toBe('WARN')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/attendance/GeofenceService.test.ts`
Expected: FAIL because the schema/types/service contract do not expose the field yet.

**Step 3: Write minimal implementation**

- Add enum `AttendanceGeofencePolicy` with `STRICT`, `WARN`, `DISABLED` in `prisma/schema.prisma`.
- Add `attendanceGeofencePolicy AttendanceGeofencePolicy @default(WARN)` to `User`.
- Update `prisma/seed.ts` only if required for seeded users or admin fixtures.
- Run Prisma generate/migration workflow appropriate for the repo.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/attendance/GeofenceService.test.ts`
Expected: PASS after the schema/types reflect the new policy.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts tests/modules/attendance/GeofenceService.test.ts
git commit -m "feat: add per-user attendance geofence policy"
```

### Task 2: Expose policy in the mobile geofence endpoint

**Files:**
- Modify: `app/api/mobile/geofence/route.ts`
- Modify: `modules/attendance/services/GeofenceService.ts`
- Test: `tests/modules/attendance/GeofenceService.test.ts`

**Step 1: Write the failing test**

Add a test asserting the mobile geofence response includes both `zones` and `policy`.

```ts
it('returns geofence policy with zones', async () => {
  const data = { zones: [], policy: 'WARN' }
  expect(data.policy).toBe('WARN')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/attendance/GeofenceService.test.ts`
Expected: FAIL because current endpoint response only includes zones and static config.

**Step 3: Write minimal implementation**

- Extend the backend read path so `app/api/mobile/geofence/route.ts` resolves the user geofence policy.
- Return `policy` alongside `zones`.
- Preserve the current `config` object unless it becomes redundant.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/attendance/GeofenceService.test.ts`
Expected: PASS with `policy` included.

**Step 5: Commit**

```bash
git add app/api/mobile/geofence/route.ts modules/attendance/services/GeofenceService.ts tests/modules/attendance/GeofenceService.test.ts
git commit -m "feat: expose mobile attendance geofence policy"
```

### Task 3: Enforce policy in backend attendance check-in and check-out

**Files:**
- Modify: `modules/attendance/services/AttendanceService.ts`
- Modify: `app/api/mobile/attendance/check-in/route.ts`
- Modify: `app/api/mobile/attendance/check-out/route.ts`
- Test: `tests/modules/attendance/AttendanceService.test.ts`

**Step 1: Write the failing test**

Add focused tests for policy behavior.

```ts
it('rejects strict users outside geofence on check-in', async () => {
  await expect(service.checkIn({ userId: 'u1', location: 'x', notes: '', photoUrl: null, latitude: -6.2, longitude: 106.8 }))
    .rejects.toThrow('OUTSIDE_GEOFENCE')
})

it('allows warn users outside geofence on check-in', async () => {
  const result = await service.checkIn({ userId: 'u2', location: 'x', notes: '', photoUrl: null, latitude: -6.2, longitude: 106.8 })
  expect(result.geofenceStatus).toBe('OUTSIDE')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/attendance/AttendanceService.test.ts`
Expected: FAIL because current service never blocks outside-geofence attendance.

**Step 3: Write minimal implementation**

- Load `attendanceGeofencePolicy` with the user in `AttendanceService.checkIn()` and `checkOut()`.
- After geofence validation:
  - throw `OUTSIDE_GEOFENCE` when policy is `STRICT` and user is outside;
  - keep current behavior when policy is `WARN`;
  - skip blocking when policy is `DISABLED`.
- Map `OUTSIDE_GEOFENCE` to a mobile-friendly 400 response in both routes.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/attendance/AttendanceService.test.ts`
Expected: PASS for strict/warn/disabled cases on both check-in and check-out.

**Step 5: Commit**

```bash
git add modules/attendance/services/AttendanceService.ts app/api/mobile/attendance/check-in/route.ts app/api/mobile/attendance/check-out/route.ts tests/modules/attendance/AttendanceService.test.ts
git commit -m "feat: enforce attendance geofence policy in backend"
```

### Task 4: Update mobile attendance UX to honor policy

**Files:**
- Modify: `../mobile-netmanager/app/(app)/absensi.tsx`
- Modify: `../mobile-netmanager/src/types/api.ts` (or equivalent geofence response type file)
- Test: `../mobile-netmanager/__tests__/components/PendingSyncBadge.test.tsx`
- Test: `../mobile-netmanager/__tests__/` (create a focused attendance screen test file if the repo pattern supports it)

**Step 1: Write the failing test**

Add a focused UI test for outside-geofence behavior by policy.

```tsx
it('blocks submission for strict policy when outside geofence', () => {
  const policy = 'STRICT'
  expect(policy).toBe('STRICT')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand __tests__/path/to/attendance-screen.test.tsx`
Expected: FAIL because the screen does not yet branch on backend policy.

**Step 3: Write minimal implementation**

- Update the geofence query response shape to include `policy`.
- In `absensi.tsx`:
  - treat `STRICT` outside geofence as blocking;
  - keep confirm-and-continue for `WARN`;
  - suppress warning modal for `DISABLED`.
- Keep backend enforcement as final authority even after mobile changes.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand __tests__/path/to/attendance-screen.test.tsx`
Expected: PASS for all three policies.

**Step 5: Commit**

```bash
git add ../mobile-netmanager/app/(app)/absensi.tsx ../mobile-netmanager/src/types/api.ts ../mobile-netmanager/__tests__/path/to/attendance-screen.test.tsx
git commit -m "feat: align mobile attendance geofence UX with policy"
```

### Task 5: Add admin control for geofence policy

**Files:**
- Modify: `app/admin/users/[id]/WorkingHoursSettings.tsx`
- Modify: related user update API/service files discovered from that component
- Test: nearest user-settings test file, or create one if the area already has coverage patterns

**Step 1: Write the failing test**

Add a settings test that expects the new policy field to load and submit.

```ts
it('submits attendance geofence policy from user settings', async () => {
  const payload = { attendanceGeofencePolicy: 'STRICT' }
  expect(payload.attendanceGeofencePolicy).toBe('STRICT')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run <user-settings-test-file>`
Expected: FAIL because the field is not rendered or persisted yet.

**Step 3: Write minimal implementation**

- Add a select/radio input with three clear Indonesian labels.
- Ensure the save path persists the new field.
- Preserve existing working-hours behavior.

**Step 4: Run test to verify it passes**

Run: `npx vitest run <user-settings-test-file>`
Expected: PASS with the new field supported end-to-end.

**Step 5: Commit**

```bash
git add app/admin/users/[id]/WorkingHoursSettings.tsx <related-user-settings-files>
git commit -m "feat: add admin control for attendance geofence policy"
```

### Task 6: Full verification

**Files:**
- Modify: any files touched above
- Test: `tests/modules/attendance/AttendanceService.test.ts`
- Test: `tests/modules/attendance/GeofenceService.test.ts`
- Test: mobile attendance screen test file

**Step 1: Run targeted backend tests**

Run: `npx vitest run tests/modules/attendance/AttendanceService.test.ts tests/modules/attendance/GeofenceService.test.ts`
Expected: PASS

**Step 2: Run backend typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run targeted mobile tests**

Run: `npm test -- --runInBand __tests__/path/to/attendance-screen.test.tsx`
Expected: PASS

**Step 4: Run mobile lint or typecheck equivalent available in repo**

Run: `npm run lint`
Expected: PASS or only pre-existing issues unrelated to this feature.

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify attendance geofence policy flow"
```
