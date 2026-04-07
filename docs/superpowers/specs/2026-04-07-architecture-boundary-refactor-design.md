# Architecture Boundary Refactor Design

Date: 2026-04-07

## Objective
Refactor the current hotspots so the codebase better follows the modular monolith rules in `CLAUDE.md`:
- UI -> API (thin) -> Service -> Repository -> Database
- modules communicate through public APIs / service entrypoints
- no cross-module repository imports
- API routes remain thin

This refactor will preserve behavior while improving boundaries, reducing god files, and making the main hotspots easier to test and maintain.

## Scope
This design covers the architecture and code-smell findings previously identified:

### Boundary hotspots
- `app/api/pelanggan-ppp/[id]/route.ts`
- `app/admin/pelanggan/ppp/[id]/PppDetailClient.tsx`
- `app/admin/pelanggan/ppp/PppList.tsx`
- `app/admin/pelanggan/ppp/[id]/CustomerInvoiceHistory.tsx`
- `app/admin/AdminDashboardClient.tsx`
- `app/admin/integrations/mixradius/page.tsx`
- `app/admin/finance/unpaid/page.tsx`
- `app/karyawan/work-order/page.tsx`
- `app/karyawan/izin/page.tsx`
- `app/karyawan/lembur/page.tsx`

### Cross-module repository violations
- `modules/inventory/services/AssetService.ts`
- `modules/finance/services/AutomaticBillingService.ts`
- `modules/finance/services/AutomaticIsolationService.ts`
- `modules/notification/services/ExpoPushService.ts`

## Non-goals
- No unrelated feature work
- No schema changes unless strictly required by compilation issues
- No speculative internal framework or generic abstraction layer
- No behavior changes outside the refactor targets

## Chosen approach
Use a boundary-first refactor, then split files by responsibility.

### Why this approach
A big-bang rewrite would create too much merge/conflict risk across the repo. A compatibility facade-only approach would reduce immediate risk but leave the codebase with extra indirection and many existing smell points.

Boundary-first refactoring gives the best balance:
1. Fix the architecture violations first.
2. Keep behavior stable while shifting orchestration into the right layer.
3. Split the remaining large files after the dependency direction is correct.
4. Parallelize implementation across mostly independent slices.

## Target architecture

### 1. Thin API route pattern
Target shape for large routes:
- route parses request/context
- route calls a focused service/use-case
- route serializes response
- route keeps only boundary validation and HTTP mapping

Business orchestration such as tenant scoping, rule checks, password hashing, billing side effects, and sync side effects moves into the relevant service layer.

### 2. No direct persistence in `app/*`
Pages, server components, and client entrypoints must not import:
- `prisma`
- repositories
- `@/lib/repositories`

Instead they call a module-level query/service entrypoint that expresses the use-case they need.

### 3. Module-to-module dependency rules
If module A needs data or behavior from module B:
- module A may call module B service/public API
- module A must not import module B repository directly

Repositories remain internal persistence details of each module.

### 4. File splitting rules
Large files are split along responsibility boundaries only:
- data loader / query function
- mutation or action orchestration
- presentational section components
- local helper utilities when specific to the feature

Do not create abstractions that are only used once unless they are needed to enforce the boundary.

## Implementation slices

### Slice A — pelanggan PPP boundary cleanup
Files:
- `app/api/pelanggan-ppp/[id]/route.ts`
- `app/admin/pelanggan/ppp/[id]/PppDetailClient.tsx`
- `app/admin/pelanggan/ppp/PppList.tsx`
- `app/admin/pelanggan/ppp/[id]/CustomerInvoiceHistory.tsx`

#### Design
- Introduce focused service/query entrypoints under the relevant modules so route and pages stop doing orchestration directly.
- Move GET/PUT/DELETE orchestration from `app/api/pelanggan-ppp/[id]/route.ts` into pelanggan/finance-oriented services.
- Move customer detail loading and technical-info enrichment into a query-level function or service entrypoint instead of querying Prisma in the page.
- Split PPP list responsibilities into smaller pieces:
  - list/container state and fetching
  - action handlers
  - column/action configuration or presentational pieces
- Split invoice history into fetch/mutation handling and presentational rendering sections.

#### Expected outcome
- route becomes substantially thinner
- PPP pages no longer touch Prisma/repositories directly
- large PPP UI files become smaller and more focused

### Slice B — dashboard and employee page boundary cleanup
Files:
- `app/admin/AdminDashboardClient.tsx`
- `app/admin/integrations/mixradius/page.tsx`
- `app/admin/finance/unpaid/page.tsx`
- `app/karyawan/work-order/page.tsx`
- `app/karyawan/izin/page.tsx`
- `app/karyawan/lembur/page.tsx`

#### Design
- Replace direct Prisma/repository usage in `app/*` with module query/service entrypoints.
- For dashboard, separate page-level auth/permission orchestration from dashboard data aggregation and keep UI composition focused.
- For employee pages, provide module-level functions for the specific list/read use-cases instead of instantiating repositories in the page.
- For simple admin pages using one-off Prisma reads, add narrowly scoped query functions rather than generic service locators.

#### Expected outcome
- `app/*` stops bypassing service boundaries
- dashboard page becomes easier to reason about
- employee pages align with the same layering rules as API routes

### Slice C — cross-module repository cleanup
Files:
- `modules/inventory/services/AssetService.ts`
- `modules/finance/services/AutomaticBillingService.ts`
- `modules/finance/services/AutomaticIsolationService.ts`
- `modules/notification/services/ExpoPushService.ts`

#### Design
- Replace direct imports of another module’s repositories with exported service/public API access.
- Keep repository types and implementation internal to their owning module.
- Prefer narrowly scoped application methods that express the real use-case, e.g. fetching customers eligible for billing, clearing push tokens, creating depreciation expense, or changing customer status.

#### Expected outcome
- dependency direction matches the modular monolith rule
- services depend on behaviors, not foreign persistence details
- future internal repository changes stay local to each module

### Slice D — verification and integration
Tasks:
- integrate changes from the parallel slices
- resolve any import/type conflicts
- run `npm run lint`
- run `npm run typecheck`
- run `npm run build`
- fix root-cause issues until all pass cleanly

## Parallelization plan
Implementation will be parallelized across independent slices to control context size and speed execution:
- Agent 1: Slice A
- Agent 2: Slice B
- Agent 3: Slice C
- Main session: integration, final verification, any small cross-slice fixes

Each agent will be given the written design constraints explicitly so they follow the same plan.

## Robustness requirements
- Preserve existing behavior and API contracts unless compilation or architecture correction requires a minimal, justified adjustment.
- Avoid introducing insecure code or widening trust boundaries.
- Do not silence problems with `any`, disabled rules, or placeholder code unless already present and unavoidable for compatibility.
- Prefer targeted refactor over broad churn.

## Testing and verification strategy

### Verification gates
1. After each slice: quick local sanity review for imports and obvious type drift.
2. After integration: full repository verification.

### Required final commands
- `npm run lint`
- `npm run typecheck`
- `npm run build`

If any command fails, fix the underlying cause and rerun until all succeed.

## Definition of done
The refactor is complete when:
- target `app/*` files no longer import Prisma/repositories/service locators directly for data access
- target route handlers are thin controllers instead of business orchestration hubs
- targeted cross-module repository imports are removed
- major hotspot files are smaller or split by responsibility where planned
- lint, typecheck, and build all pass cleanly

## Risks and mitigation

### Risk: overlapping edits in related PPP files
Mitigation: keep one slice responsible for the PPP area and integrate centrally.

### Risk: service boundary changes cause type drift
Mitigation: use narrowly scoped entrypoints and verify imports/interfaces immediately after integration.

### Risk: refactor increases abstraction unnecessarily
Mitigation: create only the entrypoints needed for the audited hotspots; avoid reusable layers without a second concrete use.

## Notes on git workflow
This design document will be written to the repo for review, but code commits will only be created if explicitly requested by the user.