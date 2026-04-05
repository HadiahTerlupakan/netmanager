# Admin Settings Cleanup Plan

## Goal
Reduce the main maintainability and architecture debt in admin settings without a risky rewrite.

## Scope
Primary targets:
- `app/api/settings/general/route.ts`
- `app/api/settings/api/route.ts`
- `app/api/roles/route.ts`
- `app/admin/pengaturan/umum/GeneralSettingsClient.tsx`
- `app/admin/pengaturan/payment-gateway/components/PaymentGatewayTab.tsx`
- `app/admin/pengaturan/payment-gateway/components/ManualTransferTab.tsx`

## Non-goals
- Full redesign of admin settings UI
- Renaming all `pengaturan`/`settings` paths
- Large behavior changes or endpoint contract rewrites
- Broad test-suite expansion beyond touched behavior

## Constraints
- Preserve existing route contracts and visible behavior
- Follow modular monolith layering already used in healthier modules
- Avoid introducing `any`, suppression comments, or speculative abstractions
- Keep diff targeted to admin settings cleanup

## Workstreams

### 1. Settings domain extraction
Create a dedicated settings module so route handlers stop owning persistence details.

Planned changes:
- Add `modules/settings/` public API.
- Add repository abstraction for key-value settings reads/writes.
- Add service helpers for general settings and API/cloud settings serialization.
- Update `app/api/settings/general/route.ts` to delegate DB persistence/reads to the module.
- Update `app/api/settings/api/route.ts` to reuse the same module and remove repetitive upsert boilerplate.

Success criteria:
- Route files become orchestration-focused.
- Prisma access moves into the settings module.
- General/API settings behavior remains unchanged.

### 2. Roles API boundary cleanup
Remove direct DB access from the roles route.

Planned changes:
- Add a role-service helper for current-user role context needed by `filterRestricted`.
- Update `app/api/roles/route.ts` to stop importing `prisma` directly.

Success criteria:
- Roles route delegates persistence-related lookups to the roles module.

### 3. General settings client decomposition
Reduce controller complexity in `GeneralSettingsClient` without altering page structure.

Planned changes:
- Extract shared types/default state into a local support file.
- Extract fetch/save/backfill/controller logic into a hook or controller helper.
- Keep presentational composition with existing child cards.

Success criteria:
- `GeneralSettingsClient.tsx` becomes primarily composition/rendering.
- State transitions and fetch logic move out of the component body.

### 4. Payment settings cleanup
Reduce god-component weight in payment gateway and manual transfer tabs.

Planned changes:
- Extract provider/account modal form state + network actions into focused hooks/helpers.
- Standardize success/error handling away from scattered inline `alert` branches where practical.
- Keep route contracts and UI layout stable.

Success criteria:
- `PaymentGatewayTab.tsx` and `ManualTransferTab.tsx` shrink materially.
- Fetch/mutation logic is easier to trace and reuse.

### 5. Verification
Run targeted validation after implementation.

Planned checks:
- `lsp_diagnostics` for all changed files
- targeted tests for touched API routes/helpers if feasible
- `npm run typecheck`

QA scenarios (tool + steps + expected result):
- Workstream 1 (settings module extraction):
  - Tool: Vitest (`npm run test:run -- tests/api/settings-general-route.test.ts`)
  - Steps: call GET `/api/settings/general` with seeded settings, then POST update payload, then GET again.
  - Expected: same response shape, defaults preserved, update persisted.
- Workstream 2 (roles route boundary cleanup):
  - Tool: Vitest (`npm run test:run -- tests/api/roles-route.test.ts`)
  - Steps: run role-read permission matrix and restricted-role filtering scenario.
  - Expected: authorization behavior and filtering match pre-refactor behavior.
- Workstream 3 (general settings client decomposition):
  - Tool: TypeScript (`npm run typecheck`) + diagnostics.
  - Steps: compile after hook extraction and verify component props integration.
  - Expected: zero TS errors, same form flow semantics.
- Workstream 4 (payment settings cleanup):
  - Tool: Vitest (existing/new targeted API tests) + diagnostics.
  - Steps: fetch configs/accounts and submit save/toggle actions from extracted client helpers.
  - Expected: no contract changes, success/error flows still mapped correctly.

## Parallelization strategy
- Workstream 1 + 2 can proceed together if coordinated on module boundaries.
- Workstream 3 can run in parallel after shared general-settings types are settled.
- Workstream 4 can run independently in parallel.
- Final verification runs after all workstreams merge.

## Main risks
- Breaking response shapes for existing clients
- Accidentally widening cleanup scope into a settings-platform rewrite
- Duplicating abstractions between general settings and API settings instead of converging them
- Payment refactor changing modal behavior or user feedback timing

## Review checkpoints
1. Approve plan structure
2. Implement in parallel workstreams with non-overlapping file ownership where possible
3. Run diagnostics/tests
4. Perform final review and summarize any remaining debt
