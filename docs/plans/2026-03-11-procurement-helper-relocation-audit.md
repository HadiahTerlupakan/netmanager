# Procurement Helper Relocation Audit

## Scope

Audit whether the remaining shared lifecycle helpers that previously lived under `app/api/procurement/_utils/*` could move fully into the inventory domain.

Helpers reviewed:

- `app/api/inventory/_utils/restock-request-lifecycle.ts`
- `app/api/inventory/_utils/restock-request-status.ts`
- `app/api/inventory/_utils/restock-request-create.ts`

## Current Reference Reality

### `restock-request-lifecycle.ts`

Current production callers:

- `app/api/inventory/restock/requests/[id]/route.ts`

Current test callers:

- `tests/api/inventory-restock-request-lifecycle-routes.test.ts`

No live `/api/procurement/*` route imports remain after lifecycle endpoint disablement.

### `restock-request-status.ts`

Current production callers:

- `app/api/inventory/restock/requests/[id]/process/route.ts`
- `app/api/inventory/restock/requests/[id]/receive/route.ts`

Current test callers:

- `tests/api/inventory-restock-request-lifecycle-routes.test.ts`

No live `/api/procurement/*` route imports remain after lifecycle endpoint disablement.

### `restock-request-create.ts`

Current production callers:

- `app/api/inventory/restock/requests/route.ts`

The legacy compatibility route under `app/api/inventory/procurement/purchase-request/route.ts` has now been disabled, so this helper is already effectively inventory-owned.

## Conclusion

Yes — the two remaining procurement lifecycle helpers were inventory-owned in practice, and they have now been moved into the inventory API utility layer.

Why this is true:

- all live production callers are under `app/api/inventory/restock/*`
- the procurement lifecycle routes that previously imported them are now disabled
- the helper behavior now exists to support an inventory-led workflow, not a user-facing procurement module

## Implemented Move

The helper move has now been completed:

- `app/api/procurement/_utils/purchase-request-lifecycle.ts` -> `app/api/inventory/_utils/restock-request-lifecycle.ts`
- `app/api/procurement/_utils/purchase-order-status.ts` -> `app/api/inventory/_utils/restock-request-status.ts`

Inventory routes now import the moved helpers directly.

## Safe Next Refactor

The next safe refactor is no longer moving helper files; it is deciding whether the remaining internal procurement domain code can be reduced further or rehomed.

## Risk Level

- runtime risk: low
- refactor risk: low to medium
- business-logic risk: low, as long as the helpers are moved without changing behavior

## Bottom Line

The procurement API surface is fully retired, and the remaining lifecycle helpers are now inventory-owned both in practice and in file structure.
