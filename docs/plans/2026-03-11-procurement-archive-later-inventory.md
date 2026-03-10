# Procurement Archive-Later Inventory

## Purpose

This document records which procurement- and asset-adjacent files can be archived later with low risk, which ones must stay for now, and which ones are risky to remove.

This is based on the current state after:

- retiring `/admin/procurement`
- retiring `/admin/procurement/purchase-orders`
- retiring `/admin/inventory/assets`
- removing the related main-menu entries
- cleaning active live-screen redirects so users are not sent back to those retired routes

## Preserve Now

These files are still part of the currently used app flow and should not be archived.

### Restock UI and its active APIs

- `app/admin/inventory/restock/page.tsx`
- `app/admin/inventory/restock/RestockList.tsx`
- `components/inventory/RestockSettingsForm.tsx`
- `app/api/inventory/restock/prediction/route.ts`
- `app/api/inventory/restock/settings/route.ts`
- `app/api/inventory/procurement/purchase-request/route.ts`

Reason:

- `RestockList.tsx` still creates purchase requests through `/api/inventory/procurement/purchase-request`
- this is the only verified bridge from current inventory operations into procurement-related backend logic

## Preserve Dormant

These files are not promoted in the main UI now, but should remain until role/permission cleanup and backend retirement are intentionally planned.

### RBAC and capability metadata

- `lib/permission-config.ts`
- `lib/resource-capabilities.ts`
- `lib/role-templates.ts`

Reason:

- permissions and role templates still enumerate `procurement`, `supplier`, `purchase_orders`, and related resources
- deleting these too early could break role matrices, seeded permissions, or hidden internal access

### Procurement backend and repositories

- `modules/procurement/services/ProcurementService.ts`
- `modules/procurement/repositories/PurchaseOrderRepository.ts`
- `modules/procurement/repositories/SupplierRepository.ts`
- `app/api/procurement/purchase-requests/route.ts`
- `app/api/procurement/purchase-requests/[id]/route.ts`
- `app/api/procurement/purchase-requests/available/route.ts`
- `app/api/procurement/purchase-orders/route.ts`
- `app/api/procurement/purchase-orders/[id]/status/route.ts`

Reason:

- these remain the service/API contracts behind request approval, PO processing, receiving, and supplier support
- restock still feeds purchase requests into this domain

## Already Retired Procurement Route Wrappers

These route entry files now return `notFound()` and no longer provide a user-facing procurement UI surface.

- `app/admin/procurement/page.tsx`
- `app/admin/procurement/market-price/page.tsx`
- `app/admin/procurement/purchase-orders/page.tsx`
- `app/admin/procurement/purchase-orders/create/page.tsx`
- `app/admin/procurement/purchase-orders/[id]/page.tsx`
- `app/admin/procurement/suppliers/page.tsx`
- `app/admin/procurement/suppliers/create/page.tsx`
- `app/admin/procurement/suppliers/[id]/page.tsx`

Reason:

- the procurement route tree is now retired at the page-wrapper level
- backend APIs and shared components remain intact underneath

## Archived In This Pass

These procurement internals were physically removed after reference scans showed they no longer had live imports:

- `app/admin/procurement/ProcurementIndexClient.tsx`
- `app/admin/procurement/purchase-orders/_components/PurchaseOrderForm.tsx`
- `app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx`
- `app/admin/procurement/purchase-orders/_components/ReceiveGoodsModal.tsx`
- `app/admin/procurement/suppliers/_components/SupplierForm.tsx`

Reason:

- their route wrappers had already been retired with `notFound()`
- workspace reference scans no longer found live production imports to these files

## Archive Later With Low Risk

These are still dormant-looking, but were intentionally kept because they still have non-procurement value or need a separate review.

### Dormant/shared internals kept for now

- `components/procurement/MarketPriceCheck.tsx`

Reason:

- it is still imported by finance (`app/admin/finance/transactions/TransactionsClient.tsx`), so it is not safe to archive as part of procurement cleanup

## Risky To Archive Now

These remain functionally live enough that archiving them now would be risky.

### Asset creation and detail flows

- `components/inventory/assets/CreateAssetForm.tsx`
- `app/admin/inventory/assets/new/page.tsx`
- `components/inventory/assets/AssetDetailView.tsx`
- `app/admin/inventory/assets/[id]/page.tsx`
- `app/api/inventory/assets/route.ts`
- `app/api/inventory/assets/[id]/route.ts`
- `app/api/inventory/assets/[id]/depreciate/route.ts`
- `modules/inventory/services/AssetService.ts`
- `modules/inventory/repositories/AssetRepository.ts`

Reason:

- even though the asset list page is retired, asset create/detail/depreciation routes and APIs still exist and are internally coherent
- removing them now would delete direct asset access and depreciation behavior, which is a larger product decision than menu cleanup

## Already Cleaned In This Pass

Active live-screen links to retired routes were cleaned in:

- `components/inventory/assets/CreateAssetForm.tsx` -> now redirects to `/admin/inventory`
- `app/admin/inventory/assets/[id]/page.tsx` -> now links back to `/admin/inventory`
- `app/admin/procurement/purchase-orders/create/page.tsx` -> now redirects to `/admin/inventory/restock`
- `app/admin/procurement/purchase-orders/[id]/page.tsx` -> now redirects to `/admin/inventory/restock`
- `app/admin/procurement/purchase-orders/_components/PurchaseOrderForm.tsx` -> now redirects to `/admin/inventory/restock`

## Recommended Next Archive Order

If future cleanup continues, the lowest-risk order is:

1. archive dormant procurement entry UI under `app/admin/procurement/*`
2. archive dormant direct-URL procurement create/detail UI
3. only after usage confirmation, consider shrinking dormant procurement APIs and service/repository layer
4. treat asset create/detail/depreciation as a separate later decision, not part of procurement cleanup
