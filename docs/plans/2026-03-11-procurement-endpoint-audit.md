# Procurement Endpoint Audit

## Scope

Audit of `app/api/procurement/*` after procurement UI retirement.

Status after execution:

- first-wave disablement has been applied
- the following endpoint families now return `410 Gone` with `Endpoint procurement dinonaktifkan`:
  - `purchase-orders` list/detail CRUD
  - `purchase-requests` list and `available`
  - `suppliers` CRUD
- second-wave disablement has now also been applied to:
  - `POST /api/procurement/purchase-orders/generate`
- inventory-scoped compatibility wrappers now exist for the remaining lifecycle:
  - `POST /api/inventory/restock/requests`
  - `GET /api/inventory/restock/requests/[id]`
  - `PATCH /api/inventory/restock/requests/[id]`
  - `PATCH /api/inventory/restock/requests/[id]/process`
  - `PATCH /api/inventory/restock/requests/[id]/receive`
- legacy compatibility route has now also been disabled:
  - `POST /api/inventory/procurement/purchase-request`
- the remaining procurement lifecycle endpoints have now also been disabled:
  - `GET/PATCH /api/procurement/purchase-requests/[id]`
  - `PATCH /api/procurement/purchase-orders/[id]/status`

This answers two questions:

1. Which `/api/procurement/*` endpoints still have evidence of real usage in the repo?
2. Which ones are plausible disable candidates versus endpoints that should stay preserved for now?

## Key Finding

The only clearly live procurement-related entrypoint left in normal user flow is **not** under `/api/procurement/*`.

- Active live flow: `POST /api/inventory/restock/requests`

That route is now called from `app/admin/inventory/restock/RestockList.tsx` and creates `PurchaseRequest` records.

By contrast, direct in-repo callers for `/api/procurement/*` are now sparse to non-existent after procurement UI retirement.

## Endpoint-by-Endpoint Classification

### Keep For Now - Operationally Important

Status update:

- there are no longer any active `/api/procurement/*` lifecycle endpoints remaining
- operationally important lifecycle behavior has been moved behind inventory-scoped wrappers and shared helper logic

#### `PATCH /api/procurement/purchase-orders/[id]/status`

- No live in-repo frontend caller was found after procurement UI retirement
- But this endpoint is still the most dangerous to disable because it drives:
  - PO status transitions
  - stock updates in `barangGudang`
  - `barangMasuk` history writes
  - asset creation for asset-type items
  - quantity and total recalculation on received PO items

Conclusion:

- **disabled after wrapper parity was added**
- its business behavior now lives behind inventory-scoped wrapper routes and shared helper logic

#### `GET/PATCH /api/procurement/purchase-requests/[id]`

- No live in-repo caller was found
- But `PATCH` is still the route that approves/rejects requests and can auto-generate PO via `ProcurementService.generatePOFromPRs`
- Since `Restock` still creates `PurchaseRequest`, this endpoint is still part of the request lifecycle even if no current UI exposes it

Conclusion:

- **disabled after wrapper parity was added**
- its business behavior now lives behind inventory-scoped wrapper routes and shared helper logic

## Executed First-Wave Disablement

These endpoint surfaces have now been disabled in code:

- `GET/POST /api/procurement/purchase-orders`
- `GET/PUT/DELETE /api/procurement/purchase-orders/[id]`
- `GET /api/procurement/purchase-requests`
- `GET /api/procurement/purchase-requests/available`
- `GET/POST /api/procurement/suppliers`
- `GET/PUT/DELETE /api/procurement/suppliers/[id]`

These were chosen because no live app callers remained after procurement UI retirement.

## High-Confidence Disable Candidates

These endpoints have no verified live callers in the repo and mainly supported the retired procurement UI.

#### `GET /api/procurement/purchase-requests`

- Purpose: list/filter purchase requests
- Evidence: no live caller found outside the route itself
- Likely role: powered the retired PR list workspace

Conclusion: **disabled in first wave**

#### `GET /api/procurement/purchase-requests/available`

- Purpose: list approved, unlinked PRs for manual PO generation
- Evidence: no live caller found
- Service dependency: only wraps `ProcurementService.getAvailablePRs()`

Conclusion: **disabled in first wave**

#### `GET/POST /api/procurement/purchase-orders`

- Purpose: PO list and manual PO create
- Evidence: no live caller found
- Likely role: supported retired PO list/create UI

Conclusion: **disabled in first wave**

#### `GET/PUT/DELETE /api/procurement/purchase-orders/[id]`

- Purpose: PO detail/edit/delete
- Evidence: no live caller found
- Likely role: supported retired PO detail page

Conclusion: **disabled in first wave**

#### `POST /api/procurement/purchase-orders/generate`

- Purpose: generate PO(s) from approved PRs
- Evidence: no live caller found
- Important nuance: PR approval route already calls `ProcurementService.generatePOFromPRs(...)` directly, so this endpoint is redundant as a public API surface

Conclusion: **disabled in second wave**

#### `GET/POST /api/procurement/suppliers`

#### `GET/PUT/DELETE /api/procurement/suppliers/[id]`

- Purpose: supplier CRUD
- Evidence: no live caller found
- Likely role: supported retired supplier management UI
- Note: supplier table/schema should still be preserved for now, but these CRUD endpoints are much easier to disable than the request/order lifecycle endpoints

Conclusion: **disabled in first wave**

## Important Distinction

`No caller found` does **not** mean the underlying procurement data model is dead.

Still-active backend/data facts:

- `Restock` still creates `PurchaseRequest` via `/api/inventory/restock/requests`
- `PurchaseRequest` approval logic still exists and can generate `PurchaseOrder`
- PO receiving still updates stock and assets
- finance still reads/writes `purchaseOrder` data directly with Prisma, not through `/api/procurement/*`

So the safest mental model is:

- many `/api/procurement/*` endpoints are now **orphaned API surfaces**
- but procurement **tables and lifecycle logic** are not yet safe to remove

## Recommended Disable Order

If you want to continue shrinking procurement-related surfaces safely, use this order:

1. optionally remove the now-disabled legacy compatibility route file `/api/inventory/procurement/purchase-request`

## Safe Conclusion

- **Directly used now in live UI:** effectively none under `/api/procurement/*`
- **Preserve for now:** shared lifecycle helpers and the inventory-scoped wrappers that replaced procurement lifecycle endpoints
- **Already disabled in first wave:** `suppliers/*`, `purchase-requests/available`, list/detail CRUD endpoints for PR/PO
- **Disabled in second wave:** `purchase-orders/generate`
- **Disabled after wrapper parity:** `purchase-requests/[id]`, `purchase-orders/[id]/status`
- **Disabled after create-route migration:** `inventory/procurement/purchase-request`
