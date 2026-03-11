# Restock -> Request -> Approval -> Receive Redesign

## Goal

Shrink the remaining procurement lifecycle safely by moving the active business flow away from the broad `procurement` surface and into a smaller inventory-led process.

Target story:

1. inventory identifies restock need
2. system creates or records a `request`
3. authorized user approves or rejects the request
4. goods are received
5. stock and asset side effects are applied

The design goal is to preserve the business lifecycle while reducing the number of public procurement endpoints and procurement-specific UI assumptions.

## Current Reality

### Still-live business flow

- `RestockList.tsx` now creates requests via `POST /api/inventory/restock/requests`
- inventory-scoped wrappers now own request detail, approval/reject, process, and receive
- shared lifecycle helpers still own the approval, PO generation, stock update, and asset side effects underneath

### Current implementation status

- `POST /api/inventory/restock/requests` is now available as an inventory-scoped request creation endpoint
- `GET /api/inventory/restock/requests/[id]` is now available as an inventory-scoped request detail wrapper
- `PATCH /api/inventory/restock/requests/[id]` is now available as an inventory-scoped approve/reject wrapper
- `PATCH /api/inventory/restock/requests/[id]/process` is now available as an inventory-scoped start-shopping wrapper
- `PATCH /api/inventory/restock/requests/[id]/receive` is now available as an inventory-scoped receive wrapper
- the wrappers reuse shared lifecycle helpers extracted from the remaining procurement flow

### Current problem

- the active lifecycle is still split across inventory entrypoints and procurement lifecycle endpoints
- this makes procurement backend cleanup risky because inventory still depends on procurement-oriented concepts

## Recommended Target Shape

### User-facing product language

- `Restock`
- `Permintaan Restock` or `Permintaan Pengadaan`
- `Menunggu Approval`
- `Disetujui`
- `Diterima`

Avoid exposing `PO`, `supplier`, and `procurement` as the main language of the current workflow.

### Target endpoint families

#### Inventory-scoped request endpoints

- `POST /api/inventory/restock/requests`
- `GET /api/inventory/restock/requests`
- `GET /api/inventory/restock/requests/[id]`
- `PATCH /api/inventory/restock/requests/[id]`

Responsibilities:

- create request from restock need
- read request timeline/status
- approve or reject request

These can initially wrap the existing `PurchaseRequest` model so no schema migration is needed at phase 1.

#### Inventory-scoped receive endpoint

- `PATCH /api/inventory/restock/requests/[id]/receive`

Responsibilities:

- mark items received
- update stock
- create `barangMasuk`
- create `asset` rows when needed

This endpoint can internally call the same lower-level receiving logic that currently sits behind `/api/procurement/purchase-orders/[id]/status`.

## Suggested Internal Mapping

### Phase 1 - Compatibility layer

- keep existing tables: `PurchaseRequest`, `PurchaseRequestItem`, `PurchaseOrder`, `PurchaseOrderItem`, `Supplier`
- keep current lifecycle endpoints working
- add new inventory-scoped request/receive endpoints as wrappers over current service logic

Status:

- implemented for request create, detail, approval/reject, process, and receive
- legacy compatibility route `/api/inventory/procurement/purchase-request` has now been disabled

### Phase 2 - Shift callers

- move `Restock` UI and any future request UI to inventory-scoped endpoints only
- stop creating new callers to `/api/procurement/purchase-requests/[id]`
- stop creating new callers to `/api/procurement/purchase-orders/[id]/status`

### Phase 3 - Collapse procurement lifecycle surface

- once inventory-scoped endpoints fully own approve/reject/receive
- convert remaining procurement lifecycle endpoints into internal helpers or remove them entirely

## Data Model Strategy

Do **not** redesign the schema first.

Safer order:

1. move public API surface
2. move UI language
3. keep existing DB tables as implementation detail
4. only later decide whether `PurchaseOrder` should stay explicit or become an internal processing record

This avoids a risky schema rewrite while the business flow is still being simplified.

## Endpoint Reduction Strategy

### First-wave already disabled

- supplier CRUD endpoints
- PR list helper endpoints
- PO list/detail CRUD endpoints

### Next endpoints to preserve temporarily

- `PATCH /api/procurement/purchase-requests/[id]`
- `PATCH /api/procurement/purchase-orders/[id]/status`

### Long-term replacement target

- replace both with inventory-scoped request approval and receive endpoints

Status:

- replacement wrappers are now in place
- the legacy procurement lifecycle routes have now been disabled
- the legacy compatibility create route `/api/inventory/procurement/purchase-request` has now also been disabled

## Benefits

- simpler mental model for the team
- fewer public procurement APIs to maintain
- easier future backend cleanup because the active lifecycle becomes inventory-led
- no immediate schema risk

## Recommended Next Implementation Order

1. keep inventory-scoped endpoints as the only future-facing surface
2. continue reducing internal procurement domain code now that lifecycle helpers also live under inventory
3. later decide whether procurement tables should remain as internal implementation detail or be renamed/reworked in a deeper schema project
