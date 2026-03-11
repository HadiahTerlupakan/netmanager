# Procurement Full Cleanup Map

## Objective

Remove the user-facing `Procurement` menu carefully without affecting other menus, while preserving any backend and workflow pieces that are still required by `Restock` or future internal use.

This is a cleanup map, not a deletion order.

The guiding rule is:

- hide first
- de-emphasize second
- delete only after dependency proof

## Safety Boundary

### In scope

- top-level procurement menu visibility
- procurement dashboard visibility
- procurement-only user-facing pages that are not required for current daily operations
- stale tests/docs that assume procurement is a main menu

### Out of scope for first cleanup

- other admin menus
- inventory/restock flow
- permission model removal
- procurement backend deletion
- stock receiving side effects
- asset creation side effects

## Summary Decision

Recommended default cleanup strategy:

1. Remove `Procurement` from the sidebar
2. Keep procurement routes/backend logic dormant
3. Preserve request creation from `Restock`
4. Preserve any internal UI still needed to review or progress requests
5. Avoid deleting permissions/config until there is evidence they are fully unused

## Oracle-Validated Boundary

Oracle review confirms the safest phase 1 boundary is navigation-only.

- Change the visible menu surface first
- Keep all existing procurement routes live but unadvertised
- Keep permission/resource configuration intact
- Keep request creation from `Restock` intact
- Do not delete the mixed PR/PO workspace yet

This is the lowest-risk move with the smallest blast radius.

## File-by-File Classification

## A. Safe to hide from main navigation now

These are the first and safest cleanup targets.

### `lib/menu-config.ts`

- Current role: defines the top-level `PROCUREMENT` sidebar group and child menu items
- Action: remove or comment out the `PROCUREMENT` menu block from the visible admin menu
- Risk: low, if only this group is changed
- Must not touch: sibling menu groups such as inventory, finance, marketing, network, users, and settings

### `app/admin/procurement/page.tsx`

- Current role: procurement dashboard landing page
- Action: remove from navigation flow; optionally redirect to a safer internal route or keep reachable only by direct URL
- Risk: low to medium
- Reason: this page is PO/spend-centric and not required for the simplified current operating model

### `app/admin/procurement/ProcurementIndexClient.tsx`

- Current role: renders the procurement dashboard UI
- Action: de-emphasize with the dashboard route; do not prioritize removal in phase 1
- Risk: low if left dormant
- Note: contains misleading `Supplier Mgmt` coming-soon messaging despite existing supplier pages

### `app/admin/procurement/market-price/page.tsx`

- Current role: top-level market price analysis page
- Action: remove from sidebar/main navigation exposure
- Risk: low
- Reason: this is a supporting tool, not a core workflow for the current team

## B. Keep route, but treat as internal or dormant

These should not be top-level user entry points, but should stay available until a future phase proves they are unnecessary.

### `app/admin/procurement/purchase-orders/page.tsx`

- Current role: mixed PR and PO operational workspace
- Action: keep route; remove it from top-level menu for now
- Risk: medium to high if deleted
- Reason: this is likely still the only operational UI for reviewing purchase requests created from `Restock`

### `app/admin/procurement/purchase-orders/[id]/page.tsx`

- Current role: PO detail/workflow page with start-shopping and receive-goods actions
- Action: keep dormant/internal
- Risk: high if removed before verifying no internal operations depend on it

### `app/admin/procurement/purchase-orders/create/page.tsx`

- Current role: manual PO creation page
- Action: keep dormant/internal
- Risk: medium
- Reason: not needed as a top-level workflow right now, but cheap to retain

### `app/admin/procurement/suppliers/page.tsx`

- Current role: supplier CRUD list UI
- Action: keep dormant/internal
- Risk: low if hidden, higher if deleted without confirming no admin usage
- Reason: already not exposed in the sidebar, so this is mostly an internal page that can stay untouched

### `app/admin/procurement/suppliers/_components/SupplierForm.tsx`

- Current role: supplier create/edit form
- Action: keep dormant/internal
- Risk: low if untouched

### `components/procurement/MarketPriceCheck.tsx`

- Current role: reusable market-price tool used by the market-price page and the purchase-order form
- Action: keep
- Risk: medium if removed because it is reused inside the PO form

## C. High-risk preserve items - do not delete in cleanup phase 1

These are the most important files to preserve.

### `app/admin/inventory/restock/RestockList.tsx`

- Current role: active inventory restock UI
- Action: do not delete or break
- Reason: this page directly creates purchase requests via the inventory procurement API
- Important note: current button text `Buat PR` proves the procurement engine is still indirectly in use

### `app/api/inventory/procurement/purchase-request/route.ts`

- Current role: creates purchase requests from restock items
- Action: preserve
- Risk: very high if deleted
- Reason: this is the bridge between inventory needs and purchasing request creation

### `app/api/procurement/purchase-requests/route.ts`

- Current role: request list API
- Action: preserve
- Risk: high
- Reason: required by any request-review UI

### `app/api/procurement/purchase-requests/[id]/route.ts`

- Current role: request detail plus approve/reject, with auto PO generation path
- Action: preserve
- Risk: very high

### `app/api/procurement/purchase-requests/available/route.ts`

- Current role: returns approved unlinked requests for PO generation
- Action: preserve for now
- Risk: medium to high

### `app/api/procurement/purchase-orders/route.ts`

- Current role: list/create purchase orders
- Action: preserve
- Risk: high

### `app/api/procurement/purchase-orders/[id]/status/route.ts`

- Current role: start shopping and receive goods workflow, including stock updates and asset creation
- Action: preserve
- Risk: critical
- Reason: this route affects inventory stock and assets, not just procurement UI

### `modules/procurement/services/ProcurementService.ts`

- Current role: service layer for supplier CRUD, PO CRUD, available PRs, and PO generation from PRs
- Action: preserve
- Risk: critical

### `modules/procurement/repositories/PurchaseOrderRepository.ts`

- Current role: repository for PO list/detail/update/delete/status support
- Action: preserve
- Risk: high

## D. Preserve dormant RBAC/config support

These are not user-facing menus and should not be removed in phase 1.

### `lib/permission-config.ts`

- Current role: defines the `PROCUREMENT` permission group and resources
- Action: preserve dormant
- Risk: medium if deleted early because role matrices or permission UIs may rely on it

### `lib/resource-capabilities.ts`

- Current role: defines capability flags for `procurement` and `supplier`
- Action: preserve dormant
- Risk: medium if deleted early

## E. Tests and docs to update when the menu is hidden

### `e2e/admin/smoke-test-menus.spec.ts`

- Current role: smoke-tests a flattened list of menu paths
- Action: update if the visible navigation changes
- Risk: low to product behavior, medium to CI noise
- Reason: it hardcodes menu-related route expectations manually

### `docs/plans/2026-03-11-restock-permintaan-pengadaan-design.md`

- Current role: earlier design direction for simplifying procurement
- Action: keep, but note it is now superseded by this cleanup map

### `docs/plans/2026-03-11-restock-permintaan-pengadaan-implementation.md`

- Current role: earlier implementation plan for simplifying procurement into a request flow
- Action: keep, but treat as optional future work after cleanup

## Recommended Phase Plan

## Phase 1 - Safe surface cleanup

- remove the `PROCUREMENT` block from `lib/menu-config.ts`
- update `e2e/admin/smoke-test-menus.spec.ts`
- leave all procurement routes and backend logic intact
- do not change inventory menus
- do not remove permission resources

## Phase 2 - De-emphasize legacy procurement pages

- redirect or de-prioritize `app/admin/procurement/page.tsx`
- remove dashboard language that suggests procurement is a main active operating area
- keep operational request/PO pages available only by direct/internal access if needed

## Phase 3 - Decide what to do with dormant UI

- measure whether supplier pages, PO create pages, and market-price pages are still used
- if unused, archive or remove UI pages only after confirming no route/test/internal process still needs them

## Explicit Do-Not-Touch List

- any non-procurement menu entries in `lib/menu-config.ts`
- `app/admin/inventory/**/*`
- inventory APIs unrelated to procurement cleanup
- finance, network, marketing, user, or settings routes
- core auth/session/permission plumbing unless there is a proven procurement-only dead path

## Best First Implementation Move

If implementation starts, the safest first code change is:

1. edit `lib/menu-config.ts` to remove the visible `PROCUREMENT` menu group
2. update `e2e/admin/smoke-test-menus.spec.ts` so CI reflects the new menu reality
3. stop there and verify before touching any procurement route or backend file

That first step gives you the product cleanup you want with the smallest blast radius.
