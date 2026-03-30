# Attendance Cross-Surface Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the highest-risk attendance mismatches between mobile app, worker web, backend automation, and admin reporting by introducing shared state contracts, parity tests, replay reconciliation, and clearer evidence semantics.

**Architecture:** Treat one attendance event as the canonical unit of truth and harden every interpretation layer around it. Start by locking behavior with invariant tests, then collapse duplicate policy engines, move mobile/web status onto a shared backend contract, and only then refine reporting, weak-evidence visibility, and governance concerns.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, React Native Expo, Jest, TanStack Query

---

## Execution Order

1. Lock current system behavior with parity fixtures/tests.
2. Introduce a dedicated current-status contract and migrate mobile + worker web to it.
3. Consolidate stale-session / auto-checkout policy into one source of truth.
4. Clean up route parity gaps for mobile attendance offline metadata.
5. Harden offline replay reconciliation and conflict observability.
6. Add geofence evidence classification and admin visibility.
7. Add admin report/export parity tests and review report population bias.
8. Add privacy / governance hardening and document remaining compliance follow-up.

Tasks 1-5 are sequential and should land first. Tasks 6-8 can overlap after Task 5 is stable.

### Task-to-Execution Mapping

- **Execution Step 1** -> Task 1
- **Execution Step 2** -> Task 3
- **Execution Step 3** -> Task 2
- **Execution Step 4** -> Route parity slice from Task 7
- **Execution Step 5** -> Task 4
- **Execution Step 6** -> Task 5
- **Execution Step 7** -> Task 6
- **Execution Step 8** -> Governance slice from Task 7

---

## Cross-Surface Touch Map

Every task in this plan must explicitly consider these layers before it is marked complete:

- **Authoritative domain files**
  - `modules/attendance/services/AttendanceService.ts`
  - `modules/attendance/services/AutoCheckoutService.ts`
  - `modules/attendance/services/GeofenceService.ts`
  - `modules/attendance/services/AttendanceIdempotencyService.ts`
- **Transport / API contracts**
  - `app/api/mobile/attendance/check-in/route.ts`
  - `app/api/mobile/attendance/check-out/route.ts`
  - `app/api/mobile/attendance/history/route.ts`
  - `app/api/admin/attendance/route.ts`
  - `app/api/admin/reports/presence/route.ts`
- **Client consumers**
  - `components/attendance/AttendancePageContent.tsx`
  - `../mobile-netmanager/app/(app)/absensi.tsx`
  - `../mobile-netmanager/src/services/SyncService.ts`
- **Fixtures / tests**
  - `tests/fixtures/attendance/*`
  - `tests/integration/attendance/*`
  - `../mobile-netmanager/__tests__/fixtures/attendance/*`
- **Read models / reporting**
  - admin export path in `app/api/admin/attendance/route.ts`
  - admin dashboard path in `app/api/admin/reports/presence/route.ts`
  - `app/admin/kehadiran/laporan/ReportClient.tsx`
- **Observability / telemetry**
  - `../mobile-netmanager/src/services/AttendanceTelemetryService.ts`
  - replay / idempotency responses and any new request correlation fields

If a task changes one of these layers but does not check the adjacent layers, assume the task is incomplete.

---

## Test Ownership Model

Each phase should leave behind all four test layers, not just one:

1. **Unit tests** — business decision rules (`stale session`, `geofence evidence`, `report seeding`).
2. **Contract tests** — route payload shape and replay/status response guarantees.
3. **Integration tests** — one attendance lifecycle traced end-to-end through write path and read path.
4. **Fixture / seed validations** — fixed scenario matrix reused by report/export/mobile parity tests.

---

### Task 1: Create cross-surface attendance invariants and fixture-driven parity tests

**Files:**
- Create: `tests/fixtures/attendance/crossSurfaceAttendanceFixtures.ts`
- Create: `tests/integration/attendance/cross-surface-parity.test.ts`
- Create: `tests/api/admin-attendance-export-parity.test.ts`
- Modify: `tests/modules/attendance/AttendanceService.test.ts`
- Create: `../mobile-netmanager/__tests__/fixtures/attendance/crossSurfaceAttendanceFixtures.ts`
- Modify: `../mobile-netmanager/__tests__/utils/attendanceStatus.test.ts`

**Step 1: Write the failing test**

Create a fixture set that covers at least these scenarios:
- same-day open session
- same-day checked-out session
- overnight shift still active after midnight
- flexible session open >24h and marked stale
- `NO_CHECKOUT` system closure
- attendance outside geofence but accepted with `WARN`

Start with a backend parity test like:

```ts
it('keeps current-state interpretations aligned across surfaces for an overnight shift', async () => {
  const fixture = overnightShiftStillActiveFixture()
  expect(fixture.expected.mobileStatus).toBe('checked-in')
  expect(fixture.expected.workerWebStatus).toBe('checked-in')
  expect(fixture.expected.adminExportLabel).toBe('MASIH AKTIF')
})
```

**Step 2: Run test to verify it fails**

Run in `netmanager`:

```bash
npx vitest run tests/integration/attendance/cross-surface-parity.test.ts tests/api/admin-attendance-export-parity.test.ts tests/modules/attendance/AttendanceService.test.ts
```

Run in `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/utils/attendanceStatus.test.ts
```

Expected: FAIL because there is no shared invariant dataset and the surfaces do not yet prove parity.

**Step 3: Write minimal implementation**

- Build fixture helpers that describe one attendance event and its expected interpretations.
- Expand backend tests so `AttendanceService`, admin export semantics, and route-level expectations consume the same fixture scenarios.
- Expand the mobile status tests to use matching fixture data and assert the same business interpretation.
- Do not refactor product logic yet; this task is about creating a safety net.

**Step 4: Run test to verify it passes**

Run the same focused commands from Step 2.

Expected: PASS with a shared scenario matrix that documents where current behavior already aligns and where follow-up tasks must change behavior intentionally.

**Step 5: Commit**

```bash
git add tests/fixtures/attendance/crossSurfaceAttendanceFixtures.ts tests/integration/attendance/cross-surface-parity.test.ts tests/api/admin-attendance-export-parity.test.ts tests/modules/attendance/AttendanceService.test.ts ../mobile-netmanager/__tests__/fixtures/attendance/crossSurfaceAttendanceFixtures.ts ../mobile-netmanager/__tests__/utils/attendanceStatus.test.ts
git commit -m "test: add attendance cross-surface parity fixtures"
```

---

### Task 2: Unify stale-session and auto-checkout policy behind one source of truth

**Execution prerequisite:** Complete Task 3 first so the current-status contract is already defined before stale-session rules are centralized.

**Files:**
- Create: `modules/attendance/services/AttendanceSessionPolicyService.ts`
- Modify: `modules/attendance/services/AttendanceService.ts`
- Modify: `modules/attendance/services/AutoCheckoutService.ts`
- Modify: `app/api/mobile/attendance/history/route.ts`
- Create: `tests/modules/attendance/AttendanceSessionPolicyService.test.ts`
- Create: `tests/modules/attendance/AutoCheckoutParity.test.ts`

**Step 1: Write the failing test**

Add policy tests for:
- fixed schedule stale session auto-close result
- overnight shift before shift end should stay active
- overnight shift after shift end should close once
- flexible session >24h should become stale/auto-closed consistently

Example:

```ts
it('returns the same closure decision for inline repair and cron auto-checkout', () => {
  const decision = resolveSessionClosurePolicy(overnightShiftFixture())
  expect(decision.kind).toBe('keep-open')
})
```

**Step 2: Run test to verify it fails**

Run in `netmanager`:

```bash
npx vitest run tests/modules/attendance/AttendanceSessionPolicyService.test.ts tests/modules/attendance/AutoCheckoutParity.test.ts
```

Expected: FAIL because there is no shared policy service and the two engines still implement overlapping logic separately.

**Step 3: Write minimal implementation**

- Introduce `AttendanceSessionPolicyService.ts` to compute one normalized decision object for stale-session evaluation.
- Refactor `AttendanceService.processAutoCheckout()` to call that policy service.
- Refactor `AutoCheckoutService.runAutoCheckout()` to call the same policy service.
- Reuse that policy output in `app/api/mobile/attendance/history/route.ts` when setting `sessionMeta.isStaleFlexibleSession` or equivalent stale-session metadata.
- Keep behavior changes limited to the scenarios defined in the failing tests.

**Step 4: Run test to verify it passes**

Run in `netmanager`:

```bash
npx vitest run tests/modules/attendance/AttendanceSessionPolicyService.test.ts tests/modules/attendance/AutoCheckoutParity.test.ts tests/modules/attendance/AttendanceService.test.ts
npm run typecheck
```

Expected: PASS with one policy path driving inline repair, cron repair, and stale-session metadata.

**Step 5: Commit**

```bash
git add modules/attendance/services/AttendanceSessionPolicyService.ts modules/attendance/services/AttendanceService.ts modules/attendance/services/AutoCheckoutService.ts app/api/mobile/attendance/history/route.ts tests/modules/attendance/AttendanceSessionPolicyService.test.ts tests/modules/attendance/AutoCheckoutParity.test.ts
git commit -m "refactor: unify attendance stale-session policy"
```

---

### Task 3: Create a dedicated current-status contract and migrate mobile + worker web to it

**Files:**
- Create: `app/api/mobile/attendance/status/route.ts`
- Create: `app/api/attendance/status/route.ts`
- Modify: `app/api/mobile/attendance/history/route.ts`
- Modify: `components/attendance/AttendancePageContent.tsx`
- Modify: `../mobile-netmanager/app/(app)/absensi.tsx`
- Modify: `../mobile-netmanager/src/utils/attendanceStatus.ts`
- Create: `tests/api/mobile-attendance-status-route.test.ts`
- Create: `tests/api/web-attendance-status-route.test.ts`
- Create: `../mobile-netmanager/__tests__/attendance/currentStatusContract.test.ts`

**Step 1: Write the failing test**

Define one response contract for current status, for example:

```ts
expect(response.data).toMatchObject({
  status: 'checked-in',
  sourceAttendanceId: expect.any(String),
  stateReason: 'overnight-shift-active',
  warningMessage: null,
})
```

Add route tests plus one mobile contract test asserting the app consumes this shape instead of re-deriving status from the latest history row.

**Step 2: Run test to verify it fails**

Run in `netmanager`:

```bash
npx vitest run tests/api/mobile-attendance-status-route.test.ts tests/api/web-attendance-status-route.test.ts
```

Run in `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/attendance/currentStatusContract.test.ts
```

Expected: FAIL because the dedicated status routes do not exist and both clients still depend on local history interpretation.

**Step 3: Write minimal implementation**

- Add dedicated status routes that return one current-state contract for mobile and worker web.
- Use the unified session policy from Task 2 to determine active/stale/overnight/flexible state.
- Update `AttendancePageContent.tsx` to consume the new backend current-status route.
- Update `../mobile-netmanager/app/(app)/absensi.tsx` to consume the new status route and reduce local state derivation.
- Keep `attendanceStatus.ts` only for narrow display formatting or remove logic that duplicates backend business decisions.

**Step 4: Run test to verify it passes**

Run in `netmanager`:

```bash
npx vitest run tests/api/mobile-attendance-status-route.test.ts tests/api/web-attendance-status-route.test.ts tests/integration/attendance/cross-surface-parity.test.ts
npm run typecheck
```

Run in `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/attendance/currentStatusContract.test.ts __tests__/utils/attendanceStatus.test.ts
```

Expected: PASS with mobile and worker web reading one canonical current-state contract.

**Step 5: Commit**

```bash
git add app/api/mobile/attendance/status/route.ts app/api/attendance/status/route.ts app/api/mobile/attendance/history/route.ts components/attendance/AttendancePageContent.tsx ../mobile-netmanager/app/(app)/absensi.tsx ../mobile-netmanager/src/utils/attendanceStatus.ts tests/api/mobile-attendance-status-route.test.ts tests/api/web-attendance-status-route.test.ts ../mobile-netmanager/__tests__/attendance/currentStatusContract.test.ts
git commit -m "feat: add canonical attendance current-status contract"
```

---

### Task 4: Harden offline replay reconciliation and request correlation

**Execution prerequisite:** Complete the route parity cleanup from Task 7 first so replay logic is built on normalized offline metadata handling.

**Files:**
- Modify: `modules/attendance/services/AttendanceIdempotencyService.ts`
- Modify: `app/api/mobile/attendance/check-in/route.ts`
- Modify: `app/api/mobile/attendance/check-out/route.ts`
- Create: `app/api/admin/attendance/reconciliation/route.ts`
- Create: `tests/api/mobile-attendance-replay-reconciliation.test.ts`
- Modify: `tests/modules/attendance/AttendanceIdempotencyService.test.ts`
- Modify: `../mobile-netmanager/src/services/SyncService.ts`
- Modify: `../mobile-netmanager/src/hooks/queries/useApiMutation.ts`
- Modify: `../mobile-netmanager/src/services/AttendanceTelemetryService.ts`
- Create: `../mobile-netmanager/__tests__/services/attendanceReplayConflict.test.ts`

**Step 1: Write the failing test**

Add route/service tests that require every conflict replay to produce a verifiable final outcome:

```ts
it('returns the persisted attendance row reference when a replay hits a completed request', async () => {
  expect(response.data).toMatchObject({
    replayed: true,
    attendanceId: expect.any(String),
    requestId: 'att-123',
  })
})
```

Add one mobile test asserting a `409` replay conflict is not treated as opaque success without a correlation payload.

**Step 2: Run test to verify it fails**

Run in `netmanager`:

```bash
npx vitest run tests/api/mobile-attendance-replay-reconciliation.test.ts tests/modules/attendance/AttendanceIdempotencyService.test.ts
```

Run in `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/services/attendanceReplayConflict.test.ts __tests__/services/SyncService.test.ts
```

Expected: FAIL because the current replay path does not expose a full reconciliation contract.

**Step 3: Write minimal implementation**

- Extend idempotency completion/replay payloads so completed attendance writes expose `attendanceId`, `requestId`, and replay metadata.
- Update mobile check-in/check-out routes to return that correlation data on replayed/completed responses.
- Add an admin reconciliation route for searching attendance by `requestId` or replay state.
- Update `SyncService` and telemetry so terminal replay handling distinguishes “conflict but row exists” from “conflict with unresolved final state”.

**Step 4: Run test to verify it passes**

Run in `netmanager`:

```bash
npx vitest run tests/api/mobile-attendance-replay-reconciliation.test.ts tests/modules/attendance/AttendanceIdempotencyService.test.ts tests/integration/attendance/cross-surface-parity.test.ts
npm run typecheck
```

Run in `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/services/attendanceReplayConflict.test.ts __tests__/services/SyncService.test.ts
```

Expected: PASS with replay outcomes traceable from mobile request ID to backend attendance row.

**Step 5: Commit**

```bash
git add modules/attendance/services/AttendanceIdempotencyService.ts app/api/mobile/attendance/check-in/route.ts app/api/mobile/attendance/check-out/route.ts app/api/admin/attendance/reconciliation/route.ts tests/api/mobile-attendance-replay-reconciliation.test.ts tests/modules/attendance/AttendanceIdempotencyService.test.ts ../mobile-netmanager/src/services/SyncService.ts ../mobile-netmanager/src/hooks/queries/useApiMutation.ts ../mobile-netmanager/src/services/AttendanceTelemetryService.ts ../mobile-netmanager/__tests__/services/attendanceReplayConflict.test.ts
git commit -m "feat: add attendance replay reconciliation contract"
```

---

### Task 5: Add geofence evidence quality classification and admin visibility

**Files:**
- Modify: `modules/attendance/services/GeofenceService.ts`
- Modify: `modules/attendance/services/AttendanceService.ts`
- Modify: `app/api/admin/attendance/route.ts`
- Modify: `app/api/admin/reports/presence/route.ts`
- Create: `components/attendance/GeofenceEvidenceBadge.tsx`
- Modify: `app/admin/attendance/AttendanceClient.tsx`
- Create: `tests/modules/attendance/GeofenceEvidenceClassification.test.ts`
- Modify: `tests/modules/attendance/GeofenceService.test.ts`

**Step 1: Write the failing test**

Add evidence classification tests for:
- inside geofence
- outside but accepted under `WARN`
- site missing coordinates
- no site assigned
- coordinates omitted by client

Example:

```ts
it('marks attendance as weak evidence when accepted without usable geofence coordinates', async () => {
  expect(result.evidenceQuality).toBe('weak-missing-site-config')
})
```

**Step 2: Run test to verify it fails**

Run in `netmanager`:

```bash
npx vitest run tests/modules/attendance/GeofenceEvidenceClassification.test.ts tests/modules/attendance/GeofenceService.test.ts
```

Expected: FAIL because the current model stores geofence outcomes but not a normalized evidence-quality classification.

**Step 3: Write minimal implementation**

- Extend backend geofence evaluation to return an `evidenceQuality` classification alongside inside/outside/distance data.
- Persist that classification on the attendance write path or derive it in admin read models if persistence is too invasive for this slice.
- Expose the classification through admin attendance APIs.
- Add an admin badge/column so accepted-but-weak attendance is visible without reading raw notes.

**Step 4: Run test to verify it passes**

Run in `netmanager`:

```bash
npx vitest run tests/modules/attendance/GeofenceEvidenceClassification.test.ts tests/modules/attendance/GeofenceService.test.ts tests/api/admin-attendance-export-parity.test.ts
npm run typecheck
```

Expected: PASS with weak evidence states visible and testable.

**Step 5: Commit**

```bash
git add modules/attendance/services/GeofenceService.ts modules/attendance/services/AttendanceService.ts app/api/admin/attendance/route.ts app/api/admin/reports/presence/route.ts components/attendance/GeofenceEvidenceBadge.tsx app/admin/attendance/AttendanceClient.tsx tests/modules/attendance/GeofenceEvidenceClassification.test.ts tests/modules/attendance/GeofenceService.test.ts
git commit -m "feat: expose attendance geofence evidence quality"
```

---

### Task 6: Add admin report/export parity tests and review report population bias

**Files:**
- Modify: `modules/attendance/services/AttendanceService.ts`
- Modify: `app/api/admin/attendance/route.ts`
- Modify: `app/api/admin/reports/presence/route.ts`
- Modify: `app/admin/kehadiran/laporan/ReportClient.tsx`
- Create: `tests/api/admin-report-export-parity.test.ts`
- Create: `tests/modules/attendance/AttendanceReportPopulation.test.ts`

**Step 1: Write the failing test**

Add tests that prove the same dataset yields explainable output across:
- admin list summary
- CSV export labels
- report summary
- employee summary population

Example:

```ts
it('includes users with absence-only outcomes in employee summary when the report period requires them', async () => {
  expect(report.employeeSummary.map((x) => x.userId)).toContain('user-alpha-only')
})
```

**Step 2: Run test to verify it fails**

Run in `netmanager`:

```bash
npx vitest run tests/api/admin-report-export-parity.test.ts tests/modules/attendance/AttendanceReportPopulation.test.ts
```

Expected: FAIL because report/export semantics are not yet locked together and summary seeding may omit edge populations.

**Step 3: Write minimal implementation**

- Adjust `AttendanceService.getReportData(...)` so employee summary seeding matches the intended business population for the report period.
- Preserve deliberate differences between raw export labels and report derivations, but document and test them explicitly.
- Update `ReportClient.tsx` only if new fields or explanatory labels are needed to avoid confusing admins.

**Step 4: Run test to verify it passes**

Run in `netmanager`:

```bash
npx vitest run tests/api/admin-report-export-parity.test.ts tests/modules/attendance/AttendanceReportPopulation.test.ts tests/api/admin-attendance-export-parity.test.ts
npm run typecheck
```

Expected: PASS with report/export behavior intentionally documented by tests.

**Step 5: Commit**

```bash
git add modules/attendance/services/AttendanceService.ts app/api/admin/attendance/route.ts app/api/admin/reports/presence/route.ts app/admin/kehadiran/laporan/ReportClient.tsx tests/api/admin-report-export-parity.test.ts tests/modules/attendance/AttendanceReportPopulation.test.ts
git commit -m "test: lock admin attendance report and export parity"
```

---

### Task 7: Clean up route parity gaps and codify privacy / governance controls

**Files:**
- Modify: `app/api/mobile/attendance/check-in/route.ts`
- Modify: `app/api/mobile/attendance/check-out/route.ts`
- Create: `tests/api/mobile-attendance-route-parity.test.ts`
- Modify: `../mobile-netmanager/src/components/organisms/FaceVerificationModal.tsx`
- Modify: `../mobile-netmanager/app/_layout.tsx`
- Modify: `../mobile-netmanager/src/services/AttendanceTelemetryService.ts`
- Create: `docs/audits/attendance-data-governance-followup.md`

**Step 1: Write the failing test**

Add route-parity tests that require check-in and check-out to treat JSON and multipart offline metadata consistently.

Example:

```ts
it('verifies signed offline metadata for checkout in both json and multipart paths', async () => {
  expect(result.status).toBe(200)
})
```

Add a documentation acceptance checklist covering:
- face verification retention window
- exact telemetry fields retained
- who can access precise location/biometric artifacts

**Step 2: Run test to verify it fails**

Run in `netmanager`:

```bash
npx vitest run tests/api/mobile-attendance-route-parity.test.ts
```

Run in `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/services/SyncService.test.ts
```

Expected: FAIL on route parity if checkout multipart flow still lacks the same offline metadata verification path.

**Step 3: Write minimal implementation**

- **Route parity slice (must land before Task 4):** make check-out route offline metadata handling match check-in route for both JSON and multipart paths.
- **Governance slice (can land after Tasks 5-6):** reduce raw telemetry/verification data retention to the minimum required by product needs.
- Add a follow-up governance note in `docs/audits/attendance-data-governance-followup.md` that records retention, access, and escalation decisions still needing product/legal sign-off.

**Step 4: Run test to verify it passes**

Run in `netmanager`:

```bash
npx vitest run tests/api/mobile-attendance-route-parity.test.ts tests/api/mobile-attendance-replay-reconciliation.test.ts
npm run typecheck
npm run build
```

Run in `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/services/SyncService.test.ts
npm run lint
```

Expected: PASS with route parity closed and governance follow-up documented.

**Step 5: Commit**

```bash
git add app/api/mobile/attendance/check-in/route.ts app/api/mobile/attendance/check-out/route.ts tests/api/mobile-attendance-route-parity.test.ts ../mobile-netmanager/src/components/organisms/FaceVerificationModal.tsx ../mobile-netmanager/app/_layout.tsx ../mobile-netmanager/src/services/AttendanceTelemetryService.ts docs/audits/attendance-data-governance-followup.md
git commit -m "fix: align mobile attendance route parity and governance follow-up"
```

---

## Completion Criteria

- One canonical current-status contract is used by mobile and worker web.
- Inline stale-session repair and cron auto-checkout use one shared policy engine.
- Mobile replay conflicts can be reconciled to a specific attendance row via request ID.
- Admin UI/reporting can distinguish accepted attendance with weak geofence evidence.
- Report/export semantics are locked by tests against a shared scenario matrix.
- JSON vs multipart attendance route parity is covered by tests.
- Privacy/governance follow-up for face verification and precise telemetry is documented explicitly.

### Cross-Phase Regression Gates

- The same lifecycle fixture matrix remains green after Task 3 and Task 2 both land.
- Mobile/web current-status parity remains green after route parity cleanup and replay changes.
- Admin report/export parity tests remain green after geofence evidence and reconciliation changes.
- Replay/conflict tests prove `requestId -> attendanceId` correlation for completed and replayed requests.
- Privacy/governance checks confirm no new sensitive fields leak into telemetry, fixtures, or admin surfaces.

---

## Suggested Verification Sweep After Each Milestone

In `netmanager`:

```bash
npm run lint
npm run typecheck
npx vitest run tests/modules/attendance/AttendanceService.test.ts tests/integration/attendance/cross-surface-parity.test.ts tests/api/admin-attendance-export-parity.test.ts
```

In `mobile-netmanager`:

```bash
npm test -- --runInBand __tests__/utils/attendanceStatus.test.ts __tests__/services/SyncService.test.ts
npm run lint
```

Run broader sweeps before finishing Tasks 4, 6, and 7.
