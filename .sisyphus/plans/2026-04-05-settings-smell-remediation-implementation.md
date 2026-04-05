# Settings Smell Remediation Implementation Plan

## Goal
Implement safe, high-impact remediation for confirmed settings-menu smells without changing external behavior.

## Scope
- `app/api/settings/public/route.ts`
- `app/api/admin/settings/email/route.ts`
- `app/api/admin/settings/whatsapp/route.ts`
- `modules/settings/repositories/SettingsRepository.ts`
- `modules/settings/services/*` (new focused services)
- `modules/settings/index.ts`
- `app/admin/pengaturan/acs/VendorConfigTab.tsx`
- SOT docs:
  - `docs/audits/settings-audit-report.md`
  - `docs/audits/2026-04-04-netmanager-full-audit-source-of-truth.md`

## Non-goals
- Rewrite all settings routes to a new platform.
- Full decomposition of `AppVersionClient.tsx` in this cycle.
- Menu route renaming (`pengaturan` vs `settings`).

## Workstreams

### 1) Fix public-settings contract drift (High)
Problem:
- `GET /api/settings/public` reads legacy keys `general` and `logo`, while active settings flows use granular keys `GENERAL_*` and `LOGO_*`.

Plan:
- Add a focused settings service to read/map public-safe granular settings.
- Update `app/api/settings/public/route.ts` to delegate to service output.

Success criteria:
- Response shape remains unchanged (`namaAplikasi`, `perusahaan`, `logoAplikasi`, `logoInvoice`).
- Data source aligned with granular canonical keys.

QA scenario:
- Tool: Vitest API route test or direct API smoke check in local dev.
- Steps:
  1. Seed granular keys `GENERAL_NAMA_APLIKASI`, `GENERAL_PERUSAHAAN`, `LOGO_APLIKASI`, `LOGO_INVOICE`.
  2. Call `GET /api/settings/public`.
  3. Validate response contains identical contract fields and values sourced from those granular keys.
- Expected:
  - HTTP 200.
  - `{ success: true, data: { namaAplikasi, perusahaan, logoAplikasi, logoInvoice } }` unchanged.
  - No dependency on legacy `general` / `logo` keys.

### 2) Reduce route-layer duplication in email/whatsapp settings (High)
Problem:
- Email and WhatsApp admin routes duplicate settings-fetch/decrypt and upsert loops.

Plan:
- Add reusable tenant settings service helpers for:
  - reading tenant-scoped key-value settings,
  - optional decryption for selected keys,
  - bulk upsert with tenant scope.
- Refactor `email` and `whatsapp` routes to use the shared helpers while preserving permissions, payload behavior, and messages.

Success criteria:
- No behavior contract change for existing clients.
- Shared logic lives in `modules/settings/services` instead of duplicated route blocks.

QA scenario:
- Tool: targeted route tests (or local API calls) + TypeScript typecheck.
- Steps:
  1. Call `GET /api/admin/settings/email` and `GET /api/admin/settings/whatsapp` with tenant-scoped seeded settings.
  2. Call `PUT` to both endpoints with update payloads (including encrypted fields).
  3. Re-fetch and verify values persist with expected defaults and decryption behavior.
- Expected:
  - Existing success/error messages and response field names preserved.
  - Tenant scoping preserved.
  - Encrypted secrets remain encrypted at rest and decrypted on read where applicable.

### 3) Contained UI smell reduction in ACS vendor tab (Medium)
Problem:
- `VendorConfigTab.tsx` uses `any` heavily and duplicates request logic patterns.

Plan:
- Replace `any` state with explicit local types for vendor/wifi entities and modal state.
- Extract repeated mutation flow into small local request helpers (save/delete by resource) to reduce branch duplication.

Success criteria:
- No `any` in primary state/map paths.
- Same UI behavior and endpoint contracts.

QA scenario:
- Tool: TypeScript typecheck + manual UI smoke.
- Steps:
  1. Open ACS Vendor tab, switch between `vendors` and `wifi` sub-tabs.
  2. Perform create/edit/delete on vendor and wifi config with valid data.
  3. Validate toast outcomes and list refresh behavior.
- Expected:
  - No regression in CRUD flows.
  - Compile-time types catch invalid modal/data state.
  - Endpoint payload/URL behavior unchanged.

### 4) Verification
- Run `lsp_diagnostics` on all changed files.
- Run targeted checks:
  - `npm run typecheck`
  - targeted tests for touched settings routes if available.

### 5) SOT update
- Update `docs/audits/settings-audit-report.md` with implemented fixes and residual risks.
- Append a new phase section to `docs/audits/2026-04-04-netmanager-full-audit-source-of-truth.md` with boundary decisions and verification evidence.

QA scenario:
- Tool: markdown lint/format check + manual content review diff.
- Steps:
  1. Ensure both SOT files include date-stamped remediation summary, changed file evidence, verification results, and residual risks.
  2. Confirm narrative matches real implementation (no planned-but-not-done claims).
  3. Run repository check (`npm run check` or at minimum lint/typecheck) to ensure docs changes do not break CI quality gates.
- Expected:
  - SOT documents reflect implemented state accurately.
  - No markdown/build/lint regression introduced by documentation updates.

## Risk Controls
- Preserve API response shapes and success/error messaging.
- Keep changes additive and scoped to settings domain only.
- Avoid changing authentication/permission semantics.
