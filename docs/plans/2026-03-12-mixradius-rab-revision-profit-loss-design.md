# Mixradius RAB Revision Profit Loss Design

## Status

- Working design baseline captured from the current discussion
- Final baseline for analysis is the latest approved revision
- Realized cost defaults to linked `Expense` transactions through `rabItemId` and `rabProjectId`

## Problem

The current Mixradius RAB flow supports creating, editing, approving, and tracking actual achievements for a project, but it does not preserve price revisions as first-class business data.

- `RabProject` and `RabItem` currently behave like one mutable active version
- Editing a RAB replaces item data, so the original budget and any intermediate revision history are lost
- Daily expenses can already link to `rabItemId`, but there is no final approved revision baseline to compare against
- The team needs to know whether the project ends up more efficient or more expensive after market price changes, both for goods and for OPEX

## Product Goal

Add a revision workflow to Mixradius RAB so that:

1. The original RAB remains preserved as the starting budget
2. Every revision is stored as an immutable snapshot with reason and approval history
3. The latest approved revision becomes the final baseline used for project cost analysis
4. The system shows whether actual spending is profitable or loss-making relative to that final baseline

## Design Principles

- Preserve the original budget and all approved revisions for auditability
- Keep the approval mental model close to the current RAB approval workflow
- Reuse existing expense linkage instead of introducing duplicate manual actual-cost entry in phase 1
- Make variance visible at two levels: project summary and per-item or per-OPEX detail
- Prefer additive schema and API changes over risky rewrites of the existing RAB flow

## Recommended Domain Model

### Existing entities that remain

- `RabProject` remains the canonical project record and stores the original budget assumptions
- `RabItem` remains the original project item list used as the source budget
- `Expense` remains the source of realized cost, linked through `rabItemId` or `rabProjectId`
- `RabApproval` remains the existing approval history for the original project document

### New entities

#### `RabRevision`

Stores a full revision snapshot at the project level.

Recommended fields:

- `id`
- `rabProjectId`
- `revisionNumber`
- `status` with values such as `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`
- `reason`
- `notes` optional
- `submittedById` optional
- `submittedAt` optional
- `approvedById` optional for final approver metadata if needed
- `approvedAt` optional
- `rejectedById` optional
- `rejectedAt` optional
- `totalCapex`
- `totalOpex`
- `createdById`
- timestamps

#### `RabRevisionItem`

Stores immutable line-item data for a revision snapshot.

Recommended fields:

- `id`
- `rabRevisionId`
- `rabItemId` optional link back to the original item when the line originated from the base RAB
- `name`
- `description` optional
- `quantity`
- `unitPrice`
- `totalPrice`
- `category`
- `expenseType`
- `expenseCategoryId` optional
- `wbsId` optional if the project uses WBS grouping
- `sortOrder` optional

#### `RabRevisionApproval`

If revision approval history must remain separate from base-RAB approval history, add a dedicated approval table for revisions.

Recommended fields:

- `id`
- `rabRevisionId`
- `userId`
- `status`
- `notes` optional
- `createdAt`

### New links on `RabProject`

- `finalApprovedRevisionId` optional pointer to the latest approved revision used as the final baseline
- optional `revisionCount` can be derived, so it does not need to be stored physically unless reporting needs it

## Baseline and Variance Rules

### Source of truth

- `Budget Awal`: current `RabProject` plus `RabItem` records
- `Revisi Final`: the `RabRevision` referenced by `RabProject.finalApprovedRevisionId`
- `Realisasi`: sum of `Expense.amount` linked to the project, grouped by `rabItemId` when available and otherwise treated as project-level OPEX or uncategorized realization

### Profit and loss interpretation

For the phase 1 feature, use cost variance language mapped to business labels:

- `Untung`: actual cost is lower than final approved revision baseline
- `Rugi`: actual cost is higher than final approved revision baseline
- `Sesuai`: actual cost equals the final approved revision baseline

### Core formulas

Per item:

- `finalVarianceNominal = finalRevisionTotal - actualExpenseTotal`
- `finalVariancePercent = finalVarianceNominal / finalRevisionTotal`

Project level:

- `originalToFinalCapexDelta = finalCapex - originalCapex`
- `originalToFinalOpexDelta = finalOpex - originalOpex`
- `actualVsFinalCapexDelta = finalCapex - actualCapex`
- `actualVsFinalOpexDelta = finalOpex - actualOpex`
- `netVariance = (finalCapex + finalOpex) - (actualCapex + actualOpex)`

Interpretation:

- positive variance means spending is below baseline and is shown as `Untung`
- negative variance means spending is above baseline and is shown as `Rugi`

## Recommended Workflow

### Create revision

1. User opens a RAB detail view
2. User clicks `Buat Revisi`
3. System clones the current active baseline into a draft revision
4. User edits item prices, quantities, item composition, and project OPEX assumptions inside the revision draft

### Submit and approve

1. User submits the revision with a mandatory reason
2. Revision status becomes `PENDING_APPROVAL`
3. Approver reviews the snapshot and approves or rejects it
4. By default, revision approval follows the current RAB approval rule already used in the repo: approvers must have `canApproveRab` or super admin rights, and the revision becomes fully approved after the same threshold used by the base RAB flow unless business rules later require a separate threshold
5. On approval, `RabProject.finalApprovedRevisionId` is updated to this revision
6. Older revisions remain immutable and visible in history

### Analyze

1. System recomputes project-level and item-level variance using the approved revision
2. Summary cards show original budget, final revision, realization, and net variance
3. Detail tables show which items or OPEX buckets are profitable or loss-making

## Recommended Information Architecture

### RAB list

In `app/admin/integrations/mixradius/expenses/RABList.tsx`:

- keep the existing project list structure
- add a compact revision badge such as `Rev 3`
- add a final variance badge such as `+12 jt Untung` or `-8 jt Rugi`
- avoid adding too many new columns; prefer chips or a compact summary row to reduce table bloat

### RAB detail

In `app/admin/integrations/mixradius/expenses/RABView.tsx` add three new sections:

#### Revision timeline

- shows all revisions with number, status, reason, submitter, approver, timestamps
- marks the active final baseline clearly

#### Final baseline summary

- `Budget Awal`
- `Revisi Final`
- `Realisasi`
- `Selisih Final vs Realisasi`

If a project does not yet have an approved revision, the UI should show a clear empty state such as `Belum ada revisi final`, keep the original budget visible, and suppress untung or rugi conclusions until a final baseline exists.

#### Variance breakdown

- CAPEX summary card
- OPEX summary card
- net variance summary card
- detail table per item and per OPEX bucket

### Revision editing

Add a dedicated revision editor instead of reusing direct `RABForm` mutation.

- safest option is a new revision modal or page component that starts from a snapshot
- keep the original RAB form focused on original project creation and editing before the revision workflow takes over
- if reuse is needed, share field components but not submit behavior

## API Design

### Recommended endpoints

Core data endpoints under finance:

- `GET /api/finance/rab-projects/[id]/revisions`
- `POST /api/finance/rab-projects/[id]/revisions`
- `GET /api/finance/rab-projects/[id]/revisions/[revisionId]`
- `PATCH /api/finance/rab-projects/[id]/revisions/[revisionId]` for draft-only edits
- `POST /api/finance/rab-projects/[id]/revisions/[revisionId]/submit`

Approval endpoints, either under finance or the existing Mixradius approval area:

- `POST /api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve`
- `POST /api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/reject`
- optional reminder endpoint if the current reminder workflow is reused

Read-model endpoint for UI convenience if server aggregation becomes heavy:

- `GET /api/finance/rab-projects/[id]/revision-profit-loss`

### Response design

Return serialized bigint-safe fields consistently with the existing RAB APIs.

Recommended aggregated response shape for analysis:

- `originalSummary`
- `finalRevisionSummary`
- `actualSummary`
- `varianceSummary`
- `itemVariances[]`
- `opexVariances[]`
- `revisions[]`

## Calculation Strategy

### CAPEX

- map actual expenses that link to a specific `rabItemId`
- compare summed actual amount per item against the matching final revision item total
- if an original item is removed in a later revision, keep it visible in history but do not treat it as part of the final approved baseline

### OPEX

- compare project-level `projectedOpex` from the original budget against `RabRevision.totalOpex`
- sum realized OPEX from linked project expenses that are not item-specific or are categorized as OPEX
- if category-level OPEX detail exists, show grouped OPEX buckets; otherwise start with project-level OPEX variance in phase 1

### Missing linkage behavior

- expenses without `rabItemId` but with `rabProjectId` fall back to project-level OPEX or uncategorized realization
- expenses without either link are excluded from project-specific variance analysis
- UI should surface an `Unmapped realization` subtotal so the team knows when some spending cannot be assigned cleanly

## Reuse Opportunities

- reuse salary revision ideas for reason capture and revision history presentation
- reuse current RAB approval permission checks from `app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts`
- reuse existing RAB profitability helpers in `RABList.tsx`, `RABView.tsx`, and `RABCompare.tsx` where terminology overlaps
- reuse global profit/loss visual language from `app/admin/integrations/mixradius/profit-loss/page.tsx` for summary cards and trends if needed

## Risks and Mitigations

- Risk: current RAB PATCH flow deletes and recreates items, which would destroy baseline history
  - Mitigation: never use direct project mutation as the revision history store; save snapshots in dedicated tables
- Risk: some expenses may not be linked to `rabItemId`
  - Mitigation: include project-level fallback aggregation and surface `Unmapped realization`
- Risk: users may confuse original budget editing with creating a revision
  - Mitigation: separate the original RAB edit flow from the revision workflow in the UI
- Risk: approval state may drift between base RAB and revision approvals
  - Mitigation: keep revision status explicit and keep the final baseline pointer on `RabProject`

## Acceptance Criteria

- A user can create a RAB revision from an existing project without overwriting the original budget
- The system stores revision history with reason, status, and actor metadata
- The latest approved revision becomes the active final baseline automatically
- The detail view shows original budget, final revision, realization, and variance summary
- The system shows item-level and project-level `untung/rugi` relative to the final approved revision
- Expenses not cleanly mapped to items are surfaced as project-level or unmapped realization instead of being silently ignored

## Phase Boundaries

### Phase 1

- immutable revision snapshot model
- final approved baseline pointer
- variance summary for CAPEX, OPEX, and net project level
- per-item comparison for linked expenses
- revision timeline and approval flow

### Phase 2

- manual actual OPEX adjustment for costs not yet recorded in expenses
- richer diff view between revision versions
- export report for variance analysis
- compare original budget, multiple revisions, and actuals in chart form
