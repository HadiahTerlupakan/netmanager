# Restock to Permintaan Pengadaan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current top-level procurement framing with a simpler `Restock -> Permintaan Pengadaan` workflow while reusing the existing purchase-request, PO, approval, and receiving engines.

**Architecture:** Keep backend procurement internals mostly intact and focus first on information architecture, labels, and user-facing workflow. Use the existing inventory restock trigger and the existing request/approval/receiving stack, then remap the visible UI around `Permintaan Pengadaan` so current teams can operate it without needing a dedicated procurement function.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, Vitest, Playwright, npm

---

### Task 1: Simplify the main navigation

**Files:**
- Modify: `lib/menu-config.ts`
- Modify: `e2e/admin/smoke-test-menus.spec.ts`
- Create: `e2e/admin/procurement-request-navigation.spec.ts`

**Step 1: Write the failing test**

Create `e2e/admin/procurement-request-navigation.spec.ts` with a focused menu expectation.

```ts
import { expect, test } from '@playwright/test';

test('main navigation prefers restock and permintaan pengadaan', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await page.goto('/admin');

  await expect(page.getByText('Permintaan Pengadaan')).toBeVisible();
  await expect(page.getByText('Procurement')).toHaveCount(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/admin/procurement-request-navigation.spec.ts`

Expected: FAIL because the sidebar still renders `Procurement` and does not yet expose `Permintaan Pengadaan` as the user-facing entry.

**Step 3: Write minimal implementation**

Update `lib/menu-config.ts` so the user-facing navigation:

- removes `Procurement` as a top-level menu label
- keeps `Restock` visible under inventory
- adds a single visible entry labeled `Permintaan Pengadaan`
- points that entry to the lowest-cost existing route first, likely `/admin/procurement/purchase-orders`

Keep internal procurement routes intact; phase 1 is a navigation and naming change, not a route rewrite.

Example target shape:

```ts
{
  code: 'PURCHASE_REQUESTS',
  name: 'Permintaan Pengadaan',
  path: '/admin/procurement/purchase-orders',
  icon: 'HiOutlineShoppingBag',
}
```

Update `e2e/admin/smoke-test-menus.spec.ts` so the maintained path list reflects the new visible IA and does not continue asserting the old procurement structure as the primary navigation model.

**Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/admin/procurement-request-navigation.spec.ts`

Expected: PASS

Run: `npx playwright test e2e/admin/smoke-test-menus.spec.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/menu-config.ts e2e/admin/smoke-test-menus.spec.ts e2e/admin/procurement-request-navigation.spec.ts
git commit -m "feat: simplify procurement navigation into request flow"
```

Note: only commit if explicitly requested by the user.

### Task 2: Rename the restock purchasing action

**Files:**
- Modify: `app/admin/inventory/restock/RestockList.tsx`
- Create: `tests/api/inventory-purchase-request-route.test.ts`

**Step 1: Write the failing test**

Create `tests/api/inventory-purchase-request-route.test.ts` to lock the API contract used by the restock UI.

```ts
import { describe, expect, it } from 'vitest';

describe('inventory procurement purchase request route', () => {
  it('creates a draft purchasing request from restock input', async () => {
    expect(true).toBe(false);
  });
});
```

Use the same mocking style as `tests/api/restock-check-route.test.ts`: mock session/auth, call the route handler directly, assert `201`, and verify the returned payload includes a request number and `DRAFT` status.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/inventory-purchase-request-route.test.ts`

Expected: FAIL until the real route assertions are implemented.

**Step 3: Write minimal implementation**

In `app/admin/inventory/restock/RestockList.tsx`:

- rename button text from `Buat PR` to `Ajukan Pengadaan`
- rename success messaging from `Purchase Request berhasil dibuat!` to `Permintaan pengadaan berhasil dibuat`
- after success, offer a clear next-step link or navigation hint toward the request list
- keep the existing POST target `/api/inventory/procurement/purchase-request` to avoid backend churn

Optional minimal snippet:

```ts
const successMessage = `Permintaan pengadaan berhasil dibuat. Nomor: ${result.data.nomorRequest}`;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/inventory-purchase-request-route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/admin/inventory/restock/RestockList.tsx tests/api/inventory-purchase-request-route.test.ts
git commit -m "feat: reframe restock request creation as pengadaan flow"
```

Note: only commit if explicitly requested by the user.

### Task 3: Reframe the request workspace around Permintaan Pengadaan

**Files:**
- Modify: `app/admin/procurement/purchase-orders/page.tsx`
- Modify: `app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx`
- Modify: `app/admin/procurement/purchase-orders/[id]/page.tsx`
- Create: `e2e/admin/permintaan-pengadaan-flow.spec.ts`

**Step 1: Write the failing test**

Create `e2e/admin/permintaan-pengadaan-flow.spec.ts`.

```ts
import { expect, test } from '@playwright/test';

test('request workspace is framed as permintaan pengadaan', async ({ page }) => {
  await page.goto('/admin/procurement/purchase-orders');
  await expect(page.getByRole('heading', { name: 'Permintaan Pengadaan' })).toBeVisible();
  await expect(page.getByText('Purchase Request')).toHaveCount(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/admin/permintaan-pengadaan-flow.spec.ts`

Expected: FAIL because the current page is still labeled `Procurement` and mixes PR/PO terminology in the primary heading.

**Step 3: Write minimal implementation**

In `app/admin/procurement/purchase-orders/page.tsx`:

- change the main page heading to `Permintaan Pengadaan`
- rewrite the subtitle around request handling, approval, and progress
- make the request tab the clear primary workspace
- keep the PO tab available only as a secondary operational area; do not remove it yet

In `PurchaseRequestTab.tsx`:

- rename visible labels from `Purchase Requests` to `Permintaan Pengadaan`
- clean up the most visible English/Indonesian mixing in buttons, headings, empty states, and approval dialogs
- keep current logic intact

In `[id]/page.tsx`:

- align status language with the simpler product vocabulary where practical
- keep internal PO references secondary to the request/completion story

**Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/admin/permintaan-pengadaan-flow.spec.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/admin/procurement/purchase-orders/page.tsx app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx app/admin/procurement/purchase-orders/[id]/page.tsx e2e/admin/permintaan-pengadaan-flow.spec.ts
git commit -m "feat: reframe procurement workspace as permintaan pengadaan"
```

Note: only commit if explicitly requested by the user.

### Task 4: De-emphasize the old procurement dashboard and advanced pages

**Files:**
- Modify: `app/admin/procurement/page.tsx`
- Modify: `app/admin/procurement/ProcurementIndexClient.tsx`

**Step 1: Write the failing test**

Extend `e2e/admin/procurement-request-navigation.spec.ts` with a redirect or de-emphasis expectation.

```ts
test('legacy procurement dashboard no longer acts as the primary landing page', async ({ page }) => {
  await page.goto('/admin/procurement');
  await expect(page).toHaveURL(/purchase-orders|permintaan-pengadaan/);
});
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/admin/procurement-request-navigation.spec.ts`

Expected: FAIL because the current procurement dashboard still renders as a standalone landing page.

**Step 3: Write minimal implementation**

Choose one low-cost option and implement it consistently:

- preferred: redirect `/admin/procurement` to the request workspace
- fallback: keep the page but rewrite it as a lightweight internal overview with clear links back to `Permintaan Pengadaan`

Do not surface `Supplier Mgmt` as `Segera Hadir` if the feature already exists. Either remove the card from the public-facing landing page or relabel it accurately for admin/internal use.

**Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/admin/procurement-request-navigation.spec.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/admin/procurement/page.tsx app/admin/procurement/ProcurementIndexClient.tsx e2e/admin/procurement-request-navigation.spec.ts
git commit -m "refactor: retire procurement dashboard as primary entry"
```

Note: only commit if explicitly requested by the user.

### Task 5: Full verification and regression sweep

**Files:**
- Verify: `lib/menu-config.ts`
- Verify: `app/admin/inventory/restock/RestockList.tsx`
- Verify: `app/admin/procurement/page.tsx`
- Verify: `app/admin/procurement/ProcurementIndexClient.tsx`
- Verify: `app/admin/procurement/purchase-orders/page.tsx`
- Verify: `app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx`
- Verify: `app/admin/procurement/purchase-orders/[id]/page.tsx`
- Verify: `tests/api/inventory-purchase-request-route.test.ts`
- Verify: `e2e/admin/procurement-request-navigation.spec.ts`
- Verify: `e2e/admin/permintaan-pengadaan-flow.spec.ts`

**Step 1: Run local diagnostics**

Run LSP diagnostics on every modified file and fix all errors before broader validation.

**Step 2: Run focused automated checks**

Run: `bash ./scripts/setup-test-db.sh`

Expected: test database setup succeeds

Run: `npx vitest run tests/api/inventory-purchase-request-route.test.ts`

Expected: PASS

Run: `npx playwright test e2e/admin/procurement-request-navigation.spec.ts e2e/admin/permintaan-pengadaan-flow.spec.ts`

Expected: PASS

**Step 3: Run repository-level checks**

Run: `npm run typecheck`

Expected: PASS

Run: `npm run lint`

Expected: PASS

Run: `npm run build`

Expected: PASS

**Step 4: Commit**

```bash
git add lib/menu-config.ts app/admin/inventory/restock/RestockList.tsx app/admin/procurement/page.tsx app/admin/procurement/ProcurementIndexClient.tsx app/admin/procurement/purchase-orders/page.tsx app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx app/admin/procurement/purchase-orders/[id]/page.tsx tests/api/inventory-purchase-request-route.test.ts e2e/admin/procurement-request-navigation.spec.ts e2e/admin/permintaan-pengadaan-flow.spec.ts
git commit -m "feat: simplify procurement into restock request workflow"
```

Note: only commit if explicitly requested by the user.

## Implementation Notes

- Prefer presentation-layer label mapping before enum/data-model changes
- Do not remove PO generation or receiving logic in phase 1
- Do not expose supplier and market-price as top-level navigation until there is a stronger organizational need
- Keep route churn low; it is acceptable for phase 1 labels to change while some URLs still contain `procurement`

## Suggested Execution Order

1. Navigation
2. Restock CTA and API coverage
3. Request workspace copy and flow
4. Legacy procurement landing cleanup
5. Full verification
