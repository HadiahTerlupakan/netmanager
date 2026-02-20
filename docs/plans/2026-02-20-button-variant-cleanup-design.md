## Title
Button Variant Cleanup and Dark Mode Consistency

## Context
- Repo: Next.js 16 / React 19 / TS 5.9 modular monolith; shared `<Button>` component (CVA) in `@/components/ui/Button` with variants: default, destructive, success, warning, outline, secondary, ghost, link; sizes: default, sm, lg, icon, icon-sm.
- Problem: Many `<Button>` usages lack `variant`, relying on default solid primary while carrying custom text colors/paddings meant for ghost/icon/link, causing visual clashes (especially dark mode) and redundant Tailwind classes.
- Exclusions: Keep raw `<button>` in `components/ui/Button.tsx`, `components/layout/Sidebar.tsx`, `components/layout/CommandPalette.tsx`, `app/admin/workorders/[id]/components/WoSidebar.tsx`, `app/components/ThemeToggle.tsx`.
## Goals
- Assign correct `variant`/`size` to every `<Button>` lacking them across the repo (full sweep), remove redundant classes already handled by the component, retain necessary layout/sizing/custom styles, and ensure dark mode correctness.
- Reduce className noise; drop className prop if empty; omit `variant`/`size` when default.
- Verify via lint + typecheck; spot-check dark-mode-sensitive ghost/icon/link buttons.
## Detection Strategy
- Target: `<Button` without `variant=`.
- Flagging clues: `text-(blue|indigo|red|green|orange|gray|slate|emerald|amber)...`, `bg-(red|green|orange|gray|white|slate|zinc)`, `border` + `bg-white`, `underline`, `p-1|px-2|py-1|px-3|py-2`, `h-8 w-8`, `shadow`, `rounded`, icon-only patterns.
- Manually skip excluded files (above list).
## Variant & Size Mapping Rules
- Solid backgrounds: `bg-indigo/blue` → default (remove redundant classes); `bg-red` → `destructive`; `bg-green/emerald` → `success`; `bg-orange/amber` → `warning`; `bg-gray/slate/zinc` or neutral solid → `secondary`; `border + bg-white` → `outline`.
- Ghost/icon: text-colored actions without bg (`text-*`, `p-1/px-2/py-1`, icon-only) → `variant="ghost"`; icon-only with `h-8 w-8 p-1` or similar → `size="icon-sm"`; icon-only with `p-2 h-9` → `size="icon"`.
- Link: `underline` or plain text actions (`text-primary`, inline links) → `variant="link"` (size default unless explicitly small text → `size="sm"`).
- Sizes: `px-2 py-1 text-xs|text-sm` → `size="sm"`; `px-4 py-2` → default; `px-5 py-3 text-lg` → `size="lg"`.
- Cleanup: Remove classes handled by Button (bg/text/hover per variant, rounded, transition, focus rings, font-medium, disabled opacity, default padding/shadow). Keep layout/spacing/width/gap/flex-col/custom colors not covered by variant.
## Parallel Work Split (sub-agents)
- Agent A: Inventory (KeluarTable, DetailKeluarModal, Masuk/Restock/Transfer/Opname/Gudang), shared inventory components, procurement.
- Agent B: Finance + Marketing + Pengaturan (roles/settings/payment/captcha/app-version/logo/api/company-bank-accounts/general/email/whatsapp).
- Agent C: Workorders + Attendance/Kehadiran/Lembur/Announcement/Support/Salary.
- Agent D: Network (mikrotik/radius) + Integrations (mixradius).
- Agent E: Pelanggan portal (customer-facing) + Users + Chat + PWA/Announcement/StatusChange/shared UI.
- Coordinator reviews diffs, resolves conflicts, enforces mapping rules uniformly.
## Verification Plan
- Post-integration: run `npm run lint` and `npm run typecheck`.
- Visual spot-check: ghost/icon buttons in inventory keluar actions, pagination outlines, link-style buttons in customer portal; ensure className removed when empty and default props omitted.
## Out of Scope / Constraints
- Do not modify Button component itself or excluded raw-button files.
- No behavioral changes beyond styling/props cleanup.
