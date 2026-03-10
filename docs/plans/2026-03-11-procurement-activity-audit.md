# Procurement Activity Audit

## Purpose

Short audit of which procurement tables and flows are still actively used after retiring the procurement UI, and which parts are now effectively dormant.

## Still Active

### Tables

- `PurchaseRequest`
- `PurchaseRequestItem`
- `PurchaseOrder`
- `PurchaseOrderItem`

### Why they are still active

- `app/api/inventory/restock/requests/route.ts` now creates `PurchaseRequest` + `PurchaseRequestItem` from the live `Restock` flow
- `app/api/inventory/restock/requests/[id]/route.ts` now reads, approves, and rejects requests using inventory-scoped wrappers
- `app/api/inventory/restock/requests/[id]/process/route.ts` now advances linked purchase orders into processing
- `app/api/inventory/restock/requests/[id]/receive/route.ts` now updates `PurchaseOrder` state and, on receive, mutates inventory stock and related PO item totals

### Practical meaning

- even though the procurement UI has been retired, the procurement backend data model is not dead
- the database still supports a real request -> approval -> PO -> receive flow

## Active But Indirect / Internal

### Tables

- `Supplier`

### Why

- `PurchaseOrder` still has `supplierId`
- procurement service and supplier APIs still exist
- supplier data is still part of procurement modeling and may still be read by backend flows even though supplier UI routes are retired

### Practical meaning

- `Supplier` is not a good candidate for immediate backend cleanup yet
- it is less visibly active than `PurchaseRequest`/`PurchaseOrder`, but it still belongs to the active procurement schema

## Dormant From User-Facing UI

### Flows

- procurement dashboard flow
- procurement purchase-order workspace flow
- procurement market-price page flow
- supplier management page flow

### Why

- route wrappers under `app/admin/procurement/*` now return `notFound()`
- main menu no longer exposes procurement
- users can no longer enter these flows through the normal admin UI

### Practical meaning

- these are dormant at the UI layer
- this does **not** mean the backing tables are unused

## Not Included In Procurement Cleanup

### Tables / flows touched by procurement receive logic

- `barangGudang`
- `barangMasuk`
- `asset`

### Why

- these are inventory/asset side effects triggered by PO receiving
- they are still active if any procurement receiving API is used
- they should be treated as inventory cleanup concerns, not procurement-only cleanup

## Safe Conclusion

- `PurchaseRequest` and `PurchaseOrder` families are still backend-active and should not be dropped or migrated away yet
- `Supplier` is semi-dormant from UI perspective but still part of the active procurement schema and should be preserved for now
- the dormant part is mainly the procurement **UI surface**, not the procurement **database model**

## Backend Cleanup Readiness

Before touching procurement tables directly, you would need to first remove or redesign:

1. `Restock -> purchase request` creation
2. request approval -> PO generation
3. request process/receive -> stock / asset side effects

Until those three are intentionally redesigned, procurement tables should be considered live.
