# Restock to Permintaan Pengadaan Design

## Status

- Default direction captured from the current discussion: simplify the user-facing product around `Restock -> Permintaan Pengadaan`
- This document intentionally treats the current recommendation as the working design baseline so implementation planning can proceed

## Problem

The current `Procurement` area is too heavy for the present operating model.

- The team does not yet have a dedicated procurement function
- The visible navigation suggests a broad enterprise procurement module, but the real business need is simpler: when stock needs replenishment, the team needs a clean way to request purchasing, approve it, buy the goods, and receive them into stock
- The current UI mixes `Procurement`, `Purchase Request`, `Purchase Order`, `Supplier`, and `Market Price` in a way that feels structurally advanced but operationally confusing

## Product Goal

Build a lightweight enterprise-style procurement request flow without requiring a dedicated procurement team.

The product should communicate one simple story:

1. Inventory detects or surfaces a need to buy something
2. The user submits a `Permintaan Pengadaan`
3. The request is approved
4. The purchase is executed internally
5. Goods are received and stock is updated

## Design Principles

- Keep the user's mental model task-based, not module-based
- Keep enterprise controls where they matter: approval, status history, audit trail, receiving
- Hide specialist concepts unless they are needed for the current stage of the business
- Reuse the existing backend workflow where possible to avoid creating extra work for the team
- Prefer copy and navigation changes before deep data-model changes

## Recommended Information Architecture

### User-facing navigation

- Keep `Restock` as the main inventory entry point
- Add a single user-facing list/workspace named `Permintaan Pengadaan`
- Remove `Procurement` as a top-level navigation concept

### Internal or secondary areas

- Keep `Purchase Order` as an internal implementation detail or advanced admin workspace
- Keep `Supplier` management hidden from the main menu for now
- Keep `Market Price` available as a support tool, ideally opened from request or purchase detail rather than from top-level navigation

## Recommended User Flow

### Primary flow

1. User opens `Restock`
2. For items needing replenishment, user clicks `Ajukan Pengadaan`
3. System creates a purchasing request record using the existing purchase-request engine
4. Request appears in `Permintaan Pengadaan`
5. An approver or the same operations/admin user reviews it
6. Once approved, the system may create a PO internally using the existing generation flow
7. The purchasing step is progressed internally
8. Goods are received
9. Stock is updated and the request is considered complete

### Internal system flow

- `RestockList.tsx` already calls the purchase-request API and is the correct trigger point
- The current PR approval flow remains the backbone of request review
- The current PO generation and receiving logic remain active behind the scenes
- Existing inventory and asset updates remain unchanged

## Naming Strategy

### User-facing terms

- `Ajukan Pengadaan`
- `Permintaan Pengadaan`
- `Menunggu Approval`
- `Disetujui`
- `Dalam Pembelian`
- `Selesai`

### Internal-only terms

- `Purchase Request`
- `Purchase Order`
- `Supplier`
- `Market Price`

These terms can still exist in code and internal screens, but they should not be the primary language of the main workflow.

## Status Model

Recommended user-facing statuses:

- `Draft`
- `Menunggu Approval`
- `Disetujui`
- `Dalam Pembelian`
- `Selesai`
- Optional later: `Ditolak`, `Diterima Sebagian`

The current backend enums do not need to be rewritten immediately. A presentation-layer mapping is sufficient for the first phase.

## Reuse vs Change

### Reuse now

- `app/api/inventory/procurement/purchase-request/route.ts`
- `app/api/procurement/purchase-requests/[id]/route.ts`
- `modules/procurement/services/ProcurementService.ts`
- `app/api/procurement/purchase-orders/[id]/status/route.ts`

### Change now

- Navigation in `lib/menu-config.ts`
- Restock CTA and success messaging in `app/admin/inventory/restock/RestockList.tsx`
- Request list copy and emphasis in `app/admin/procurement/purchase-orders/page.tsx`
- Request-related labels in `app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx`
- Optional redirect/de-emphasis for `app/admin/procurement/page.tsx`

### Defer for later

- Deep route renaming away from `/admin/procurement/*`
- Dedicated supplier/sourcing workspace
- Rich analytics dashboard for procurement
- Full role-based split between requester, approver, buyer, and receiver

## Migration Mapping

- Old top-level menu `Procurement` -> removed from main navigation
- Old menu `Purchase Order` -> reframed as `Permintaan Pengadaan` entry point or internal secondary page
- Old `Buat PR` action in restock -> renamed to `Ajukan Pengadaan`
- Existing PR/PO internals -> preserved
- Existing supplier and market price pages -> retained but not promoted in main IA

## Why This Fits an Enterprise-but-Simple Model

- It preserves control points that matter in larger organizations
- It avoids premature specialization in navigation and team structure
- It gives current staff a single operational path instead of several adjacent modules
- It keeps the existing backend investment alive while simplifying the surface area

## Acceptance Criteria

- A user can start purchasing from `Restock` without needing to understand procurement terminology
- The main list is understandable as `Permintaan Pengadaan`, not as an abstract procurement suite
- Approval and receiving remain auditable
- Existing PO generation and stock receiving continue to work without major rewrites
- Main navigation no longer suggests a larger procurement organization than currently exists

## Risks and Mitigations

- Risk: hidden internal pages create confusion for power users
  - Mitigation: document internal/admin-only access paths and permissions
- Risk: URL paths still contain `procurement`
  - Mitigation: accept this in phase 1; change labels first, routes later if needed
- Risk: PO concepts still leak into request screens
  - Mitigation: reframe visible copy first and keep PO terminology in secondary UI areas

## Rollout Approach

### Phase 1

- Simplify navigation and naming
- Make restock the clear entry point
- Reframe the main workspace as `Permintaan Pengadaan`

### Phase 2

- Tighten the request detail UX
- Move market-price and supplier interactions deeper into the flow

### Phase 3

- If the company grows into a fuller procurement organization, reintroduce advanced procurement navigation as optional admin capabilities
