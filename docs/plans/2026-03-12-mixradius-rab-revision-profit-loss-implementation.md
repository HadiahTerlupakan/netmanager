# Mixradius RAB Revision Profit Loss Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add immutable RAB revisions for Mixradius projects so the latest approved revision becomes the final baseline and the UI can show untung or rugi by comparing original budget, final revision, and realized expenses.

**Architecture:** Extend the Prisma model with dedicated revision snapshot tables instead of mutating the base `RabProject` or `RabItem` rows. Build draft-create, draft-edit, submit, approve, and analysis read models around those snapshots, then surface them in the Mixradius RAB detail UI as revision timeline, final baseline summary, and item or OPEX variance tables derived from linked `Expense` transactions.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, Zod, Vitest, npm

**Test DB rule:** Before any database-backed API or end-to-end test in this plan, run `bash ./scripts/setup-test-db.sh` as required by the repo guidelines. Pure utility tests can run without that setup.

---

### Task 1: Add immutable revision snapshot tables to Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_rab_revision_snapshots/migration.sql`

**Step 1: Write the failing test**

Add a schema-level regression test or repository-level expectation that fails until revision tables exist.

```ts
import { describe, expect, it } from 'vitest';

describe('rab revision schema contract', () => {
  it('tracks a final approved revision separately from the base project', () => {
    expect(true).toBe(false);
  });
});
```

Place it in `tests/api/finance/rab-revision-schema.test.ts` and replace the placeholder with a direct assertion against the repository or response shape once the API exists.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/finance/rab-revision-schema.test.ts`

Expected: FAIL because the contract is not implemented yet.

**Step 3: Write minimal implementation**

In `prisma/schema.prisma`, add:

- `finalApprovedRevisionId` on `RabProject`
- `RabRevision`
- `RabRevisionItem`
- `RabRevisionApproval` if approval history is kept separate from `RabApproval`

Keep the snapshot tables immutable after approval. Ensure `BigInt` is used for money values and add indexes on `rabProjectId`, `status`, and unique `(rabProjectId, revisionNumber)`.

**Step 4: Generate and verify Prisma artifacts**

Run: `npm run prisma:generate`

Expected: PASS and generated Prisma client includes the new models.

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api/finance/rab-revision-schema.test.ts`

Expected: PASS after the test is upgraded from placeholder to the real contract.

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/api/finance/rab-revision-schema.test.ts
git commit -m "feat: add rab revision snapshot schema"
```

Note: only commit if explicitly requested by the user.

### Task 2: Add shared variance calculation helpers

**Files:**
- Create: `lib/finance/rab-revision-variance.ts`
- Create: `tests/lib/finance/rab-revision-variance.test.ts`

**Step 1: Write the failing test**

Create `tests/lib/finance/rab-revision-variance.test.ts`.

```ts
import { describe, expect, it } from 'vitest';
import { buildRabRevisionVarianceSummary } from '@/lib/finance/rab-revision-variance';

describe('buildRabRevisionVarianceSummary', () => {
  it('marks a project as untung when actual is below the final approved revision', () => {
    const result = buildRabRevisionVarianceSummary({
      originalCapex: 100_000n,
      originalOpex: 20_000n,
      finalCapex: 120_000n,
      finalOpex: 25_000n,
      actualCapex: 110_000n,
      actualOpex: 20_000n,
    });

    expect(result.netLabel).toBe('UNTUNG');
    expect(result.netVariance).toBe(15_000n);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/finance/rab-revision-variance.test.ts`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Implement `buildRabRevisionVarianceSummary` and small focused helpers for:

- project summary variance
- item variance label generation
- bigint-safe percent formatting inputs
- separation of CAPEX and OPEX totals

Keep the module pure and independent from Prisma so it is easy to test.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/finance/rab-revision-variance.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/finance/rab-revision-variance.ts tests/lib/finance/rab-revision-variance.test.ts
git commit -m "feat: add rab revision variance helpers"
```

Note: only commit if explicitly requested by the user.

### Task 3: Create revision draft and list APIs

**Files:**
- Create: `app/api/finance/rab-projects/[id]/revisions/route.ts`
- Create: `tests/api/finance/rab-project-revisions-route.test.ts`
- Modify: `app/api/finance/rab-projects/[id]/route.ts`

**Step 1: Write the failing test**

Create `tests/api/finance/rab-project-revisions-route.test.ts`.

```ts
import { describe, expect, it } from 'vitest';

describe('POST /api/finance/rab-projects/[id]/revisions', () => {
  it('creates revision 1 by snapshotting the current project and items', async () => {
    expect(true).toBe(false);
  });
});
```

Use the same route-testing style already used in the repo for finance APIs: mock session and permissions, seed a project with items, call the route handler directly, and assert that:

- a draft revision is created
- `revisionNumber` increments correctly
- revision items mirror the active baseline at creation time

**Step 2: Run test to verify it fails**

Run: `bash ./scripts/setup-test-db.sh`

Expected: PASS

Run: `npx vitest run tests/api/finance/rab-project-revisions-route.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

Implement `GET` and `POST` in `app/api/finance/rab-projects/[id]/revisions/route.ts`.

`POST` should:

- require `expense:update` or `mixradius_expenses:update` or super admin
- clone from the final approved revision if one exists, otherwise from the original `RabProject` + `RabItem`
- create a new draft revision with immutable snapshot items
- return bigint-safe serialized totals

Update `app/api/finance/rab-projects/[id]/route.ts` to include revision summary metadata such as `finalApprovedRevisionId`, `latestRevision`, and `revisionCount` in the GET response so the detail UI can render quickly.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/finance/rab-project-revisions-route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/finance/rab-projects/[id]/route.ts app/api/finance/rab-projects/[id]/revisions/route.ts tests/api/finance/rab-project-revisions-route.test.ts
git commit -m "feat: add rab revision draft api"
```

Note: only commit if explicitly requested by the user.

### Task 4: Add draft update and submit APIs

**Files:**
- Create: `app/api/finance/rab-projects/[id]/revisions/[revisionId]/route.ts`
- Create: `app/api/finance/rab-projects/[id]/revisions/[revisionId]/submit/route.ts`
- Create: `tests/api/finance/rab-project-revision-detail-route.test.ts`

**Step 1: Write the failing test**

Create `tests/api/finance/rab-project-revision-detail-route.test.ts`.

```ts
import { describe, expect, it } from 'vitest';

describe('PATCH /api/finance/rab-projects/[id]/revisions/[revisionId]', () => {
  it('allows editing draft item prices and projected opex before submission', async () => {
    expect(true).toBe(false);
  });
});
```

Add a second test for `submit` that requires a non-empty reason and changes the status to `PENDING_APPROVAL`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/finance/rab-project-revision-detail-route.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

In the detail route:

- support `GET` for one revision snapshot
- support `PATCH` only while `status === 'DRAFT'`
- allow editing snapshot item fields and project-level OPEX totals
- recalculate revision totals on every save

In the submit route:

- validate `reason`
- lock the draft into `PENDING_APPROVAL`
- block submission if there are no items or invalid totals

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/finance/rab-project-revision-detail-route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/finance/rab-projects/[id]/revisions/[revisionId]/route.ts app/api/finance/rab-projects/[id]/revisions/[revisionId]/submit/route.ts tests/api/finance/rab-project-revision-detail-route.test.ts
git commit -m "feat: add rab revision draft editing and submit flow"
```

Note: only commit if explicitly requested by the user.

### Task 5: Add revision approval and final-baseline activation

**Files:**
- Create: `app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve/route.ts`
- Create: `app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/reject/route.ts`
- Create: `tests/api/integrations/mixradius/rab-revision-approve-route.test.ts`

**Step 1: Write the failing test**

Create `tests/api/integrations/mixradius/rab-revision-approve-route.test.ts`.

```ts
import { describe, expect, it } from 'vitest';

describe('POST /api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve', () => {
  it('marks the revision approved and promotes it to the final baseline', async () => {
    expect(true).toBe(false);
  });
});
```

Assert that approval:

- respects `canApproveRab` or super admin permission
- records approval history
- updates `RabProject.finalApprovedRevisionId`
- preserves older revisions

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/integrations/mixradius/rab-revision-approve-route.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

Mirror the current permission and actor checks from `app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts`, but apply them to `RabRevision` records instead of `RabProject`.

Approval should:

- create revision approval history
- transition status toward `APPROVED` using the same approval threshold as the current base-RAB flow unless product rules later diverge
- set `RabProject.finalApprovedRevisionId`
- optionally stamp the project status if the product needs a visible state change

Reject should:

- record the actor and optional notes
- keep the project's previous final baseline unchanged

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/integrations/mixradius/rab-revision-approve-route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve/route.ts app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/reject/route.ts tests/api/integrations/mixradius/rab-revision-approve-route.test.ts
git commit -m "feat: add rab revision approval flow"
```

Note: only commit if explicitly requested by the user.

### Task 6: Build the revision profit and loss read model

**Files:**
- Create: `app/api/finance/rab-projects/[id]/revision-profit-loss/route.ts`
- Create: `tests/api/finance/rab-project-revision-profit-loss-route.test.ts`
- Modify: `app/api/finance/expenses/route.ts` if serialization helpers need reuse

**Step 1: Write the failing test**

Create `tests/api/finance/rab-project-revision-profit-loss-route.test.ts`.

```ts
import { describe, expect, it } from 'vitest';

describe('GET /api/finance/rab-projects/[id]/revision-profit-loss', () => {
  it('returns original, final, actual, and variance summaries for a project', async () => {
    expect(true).toBe(false);
  });
});
```

Seed:

- one original project with CAPEX and OPEX values
- one approved revision with changed totals
- realized expenses linked to `rabItemId` and project-only OPEX

Assert response fields:

- `originalSummary`
- `finalRevisionSummary`
- `actualSummary`
- `varianceSummary`
- `itemVariances`
- `unmappedRealization`

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/finance/rab-project-revision-profit-loss-route.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

Implement a read-only route that:

- loads original project and item data
- loads `finalApprovedRevisionId` and snapshot items
- aggregates actual expenses by `rabItemId`
- groups project-level actual OPEX that has no item mapping
- builds the variance response using `lib/finance/rab-revision-variance.ts`
- serializes bigint-safe payloads for the UI

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/finance/rab-project-revision-profit-loss-route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/finance/rab-projects/[id]/revision-profit-loss/route.ts lib/finance/rab-revision-variance.ts tests/api/finance/rab-project-revision-profit-loss-route.test.ts
git commit -m "feat: add rab revision profit loss summary api"
```

Note: only commit if explicitly requested by the user.

### Task 7: Add revision timeline and summary UI to the RAB detail view

**Files:**
- Modify: `app/admin/integrations/mixradius/expenses/RABView.tsx`
- Create: `app/admin/integrations/mixradius/expenses/RABRevisionTimeline.tsx`
- Create: `app/admin/integrations/mixradius/expenses/RABRevisionSummaryCards.tsx`
- Create: `app/admin/integrations/mixradius/expenses/RABVarianceTable.tsx`
- Create: `tests/ui/rab-revision-summary.test.tsx`

**Step 1: Write the failing test**

Create `tests/ui/rab-revision-summary.test.tsx` with a focused render assertion.

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RABRevisionSummaryCards from '@/app/admin/integrations/mixradius/expenses/RABRevisionSummaryCards';

describe('RABRevisionSummaryCards', () => {
  it('renders original, final, actual, and variance totals', () => {
    render(
      <RABRevisionSummaryCards
        summary={{
          original: '100000',
          final: '120000',
          actual: '110000',
          variance: '10000',
          label: 'UNTUNG',
        }}
      />,
    );

    expect(screen.getByText('Budget Awal')).toBeInTheDocument();
    expect(screen.getByText('Revisi Final')).toBeInTheDocument();
    expect(screen.getByText('Realisasi')).toBeInTheDocument();
    expect(screen.getByText('UNTUNG')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/rab-revision-summary.test.tsx`

Expected: FAIL

**Step 3: Write minimal implementation**

In `RABView.tsx`:

- fetch revision list and revision profit/loss summary when the modal opens
- add a `Revisi RAB` section below the existing financial overview
- render timeline, summary cards, and variance table

In the new components:

- keep formatting consistent with the existing Mixradius summary cards
- show `Untung`, `Rugi`, or `Sesuai` with clear color coding
- surface `Unmapped realization` if present

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/rab-revision-summary.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/RABView.tsx app/admin/integrations/mixradius/expenses/RABRevisionTimeline.tsx app/admin/integrations/mixradius/expenses/RABRevisionSummaryCards.tsx app/admin/integrations/mixradius/expenses/RABVarianceTable.tsx tests/ui/rab-revision-summary.test.tsx
git commit -m "feat: show rab revision timeline and variance summary"
```

Note: only commit if explicitly requested by the user.

### Task 8: Add revision creation and draft editing UI

**Files:**
- Modify: `app/admin/integrations/mixradius/expenses/ExpensesClient.tsx`
- Modify: `app/admin/integrations/mixradius/expenses/RABList.tsx`
- Create: `app/admin/integrations/mixradius/expenses/RABRevisionForm.tsx`
- Create: `tests/ui/rab-revision-form.test.tsx`

**Step 1: Write the failing test**

Create `tests/ui/rab-revision-form.test.tsx`.

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RABRevisionForm from '@/app/admin/integrations/mixradius/expenses/RABRevisionForm';

describe('RABRevisionForm', () => {
  it('requires a revision reason before submission', () => {
    render(<RABRevisionForm open onClose={() => {}} projectId="rab-1" />);
    expect(screen.getByText('Simpan Draft')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/rab-revision-form.test.tsx`

Expected: FAIL

**Step 3: Write minimal implementation**

Create a dedicated revision form component instead of overloading the original `RABForm.tsx` submit behavior.

The revision form should:

- start from a draft revision record
- edit snapshot item quantity, unit price, and OPEX totals
- require a reason before submit
- call the new draft update and submit endpoints

Wire actions in:

- `RABList.tsx` for a quick `Buat Revisi` entry point
- `ExpensesClient.tsx` to manage modal state and refresh affected data after save or approval

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/rab-revision-form.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/ExpensesClient.tsx app/admin/integrations/mixradius/expenses/RABList.tsx app/admin/integrations/mixradius/expenses/RABRevisionForm.tsx tests/ui/rab-revision-form.test.tsx
git commit -m "feat: add rab revision draft workflow ui"
```

Note: only commit if explicitly requested by the user.

### Task 9: Add regression coverage for baseline promotion and analysis visibility

**Files:**
- Modify: `tests/api/integrations/mixradius/rab-revision-approve-route.test.ts`
- Modify: `tests/api/finance/rab-project-revision-profit-loss-route.test.ts`
- Create: `e2e/admin/mixradius-rab-revision-profit-loss.spec.ts`

**Step 1: Write the failing test**

Create `e2e/admin/mixradius-rab-revision-profit-loss.spec.ts`.

```ts
import { expect, test } from '@playwright/test';

test('approved revision becomes the final baseline in rab detail', async ({ page }) => {
  await page.goto('/admin/integrations/mixradius/expenses');
  await expect(page.getByText('Revisi Final')).toBeVisible();
});
```

If stable end-to-end login data is unavailable, keep this test behind the same guard or fixture strategy already used in the repo for admin Playwright coverage.

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/admin/mixradius-rab-revision-profit-loss.spec.ts`

Expected: FAIL until the UI and fixtures are ready.

**Step 3: Write minimal implementation**

Finalize the UI wiring and test fixtures so the e2e scenario covers:

- creating or loading a project with revisions
- approving a revision
- seeing the final baseline summary in the detail view
- confirming the variance label is visible

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/integrations/mixradius/rab-revision-approve-route.test.ts tests/api/finance/rab-project-revision-profit-loss-route.test.ts`

Expected: PASS

Run: `npx playwright test e2e/admin/mixradius-rab-revision-profit-loss.spec.ts`

Expected: PASS or documented skip using the repo's existing e2e guard strategy.

**Step 5: Commit**

```bash
git add tests/api/integrations/mixradius/rab-revision-approve-route.test.ts tests/api/finance/rab-project-revision-profit-loss-route.test.ts e2e/admin/mixradius-rab-revision-profit-loss.spec.ts
git commit -m "test: cover rab revision baseline promotion"
```

Note: only commit if explicitly requested by the user.

### Task 10: Full verification sweep

**Files:**
- Verify: `prisma/schema.prisma`
- Verify: `app/api/finance/rab-projects/[id]/route.ts`
- Verify: `app/api/finance/rab-projects/[id]/revisions/route.ts`
- Verify: `app/api/finance/rab-projects/[id]/revision-profit-loss/route.ts`
- Verify: `app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve/route.ts`
- Verify: `app/admin/integrations/mixradius/expenses/ExpensesClient.tsx`
- Verify: `app/admin/integrations/mixradius/expenses/RABList.tsx`
- Verify: `app/admin/integrations/mixradius/expenses/RABView.tsx`

**Step 1: Run targeted API and utility tests**

Run: `bash ./scripts/setup-test-db.sh`

Expected: PASS

Run:

```bash
npx vitest run tests/lib/finance/rab-revision-variance.test.ts tests/api/finance/rab-project-revisions-route.test.ts tests/api/finance/rab-project-revision-detail-route.test.ts tests/api/integrations/mixradius/rab-revision-approve-route.test.ts tests/api/finance/rab-project-revision-profit-loss-route.test.ts tests/ui/rab-revision-summary.test.tsx tests/ui/rab-revision-form.test.tsx
```

Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`

Expected: PASS

**Step 4: Run build**

Run: `npm run build`

Expected: PASS

**Step 5: Run focused e2e verification if fixtures exist**

Run: `npx playwright test e2e/admin/mixradius-rab-revision-profit-loss.spec.ts`

Expected: PASS or documented skip based on existing fixture policy.

**Step 6: Commit**

```bash
git add prisma/schema.prisma app/api/finance/rab-projects app/api/integrations/mixradius/expenses/rab app/admin/integrations/mixradius/expenses lib/finance/rab-revision-variance.ts tests/api tests/lib tests/ui e2e/admin/mixradius-rab-revision-profit-loss.spec.ts
git commit -m "feat: add rab revision profit loss workflow"
```

Note: only commit if explicitly requested by the user.
