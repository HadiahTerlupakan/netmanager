# Button Variant Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Assign correct `variant`/`size` to all `<Button>` usages lacking them, clean redundant Tailwind classes, preserve necessary layout/custom styles, and ensure dark-mode-safe visuals across the repo.

**Architecture:** Use existing CVA-based `@/components/ui/Button` variants/sizes; map current ad-hoc Tailwind styling to canonical variants (default, destructive, success, warning, outline, secondary, ghost, link) and sizes (default, sm, lg, icon, icon-sm). No component changes—only prop/class adjustments in callers.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind v4, ESLint/Prettier, npm scripts (`lint`, `typecheck`).

---

### Task 1: Enumerate targets (no `variant=`)

**Files:** Existing `*.tsx` across repo; exclude `components/ui/Button.tsx`, `components/layout/Sidebar.tsx`, `components/layout/CommandPalette.tsx`, `app/admin/workorders/[id]/components/WoSidebar.tsx`, `app/components/ThemeToggle.tsx`.

**Step 1: List candidates**
Run: `rg "<Button" app components modules --glob "*.tsx" | rg -v "variant="` to capture lines lacking `variant=`.
Expected: list of file:line with Button instances without variant prop.

**Step 2: Snapshot inventory**
Copy/save the list (for coordination) and note domain grouping (inventory, finance/marketing/settings, workorders/attendance/etc, network/integrations, customer/users/chat/UI).

### Task 2: Agent A – Inventory & Procurement

**Files (modify):**
- `components/inventory/KeluarTable.tsx`
- `components/inventory/DetailKeluarModal.tsx`
- `app/admin/inventory/*` (gudang, masuk, restock, transfer, opname, keluar list)
- `components/inventory/*` shared controls
- `app/admin/procurement/suppliers/page.tsx`

**Step 1: For each Button without variant**, apply mapping rules: ghost+icon-sm for text-colored icon actions; outline for pagination; default/destructive/warning/success per bg color.

**Step 2: Clean className** removing bg/text/hover/rounded/transition/focus/disabled/px/py handled by variant/size; keep layout/width/gap/custom colors. Drop className prop if empty; omit default variant/size props.

**Step 3: Self-check diff** ensuring icon-only buttons set `size="icon-sm"` or `size="icon"` as appropriate; pagination buttons use `variant="outline" size="sm"`.

### Task 3: Agent B – Finance, Marketing, Pengaturan/Settings

**Files (modify):**
- `app/admin/finance/**/` client components
- `app/admin/marketing/**/`
- `app/admin/settings/roles/*.tsx`
- `app/admin/pengaturan/*` (api, app-version, captcha, company-bank-accounts, email, logo, nada-dering, payment-gateway components, umum, whatsapp, general)

**Step 1: Map variants** (ghost for icon text buttons; destructive/success/warning/outline/secondary per bg/border; link for underline/text actions).

**Step 2: Clean redundant classes** as in Task 2; preserve layout widths/margins.

**Step 3: Spot-check link-style buttons** to ensure `variant="link"` where text-only.

### Task 4: Agent C – Workorders, Attendance/Kehadiran/Lembur, Announcement, Support, Salary

**Files (modify):**
- `app/admin/workorders/**/` (list, templates, detail components, sites, departments)
- `app/admin/attendance/AttendanceClient.tsx`, `app/admin/kehadiran/*`, `app/admin/lembur/*`
- `app/admin/announcement/*`, `app/admin/support/*`, `app/admin/salary/*`

**Step 1: Apply variant/size mapping** to action icons (ghost icon-sm), destructive for deletes, outline/secondary for filters/pagination, link where textual.

**Step 2: Remove redundant classes**; keep layout specifics.

### Task 5: Agent D – Network & Integrations

**Files (modify):**
- `app/admin/network/mikrotik/*`
- `app/admin/network/radius/*`
- `app/admin/integrations/mixradius/*`

**Step 1: Map variants** (outline/secondary for neutral actions, ghost for icons, destructive for deletes).

**Step 2: Clean classes**, drop className if empty.

### Task 6: Agent E – Customer Portal, Users, Chat, Shared UI

**Files (modify):**
- `app/(customer)/**/`
- `app/admin/users/**/*`, `app/admin/chat/ChatPageClient.tsx`
- Shared: `components/ui/Modal.tsx`, `components/admin/sites/MapPicker.tsx`, `components/common/MapPicker.tsx`, `components/workorder/TemplateForm.tsx`, `components/pwa/PWAInstallBanner.tsx`, `components/announcement/AnnouncementPopup.tsx`, `components/common/StatusChangeButton.tsx`, `components/ui/Combobox.tsx`, `components/ui/ResponsiveTable.tsx`, `components/ui/ImageLightbox.tsx`, `components/ui/select.tsx`, `components/ui/Toast.tsx`, `app/components/ui/TabNavigation.tsx`, `app/components/inventory/PhotoUpload.tsx`.

**Step 1: Assign variants/sizes** per mapping; emphasize link/ghost for text-only/action icons in customer portal, outline for pagination/filters.

**Step 2: Remove redundant classes**, keep layout constraints.

### Task 7: Integration review & dedupe

**Files:** All touched above.

**Step 1: Coordinator review** all diffs for consistency with mapping rules and no exclusions violated.

**Step 2: Resolve conflicts** if any overlapping edits; ensure no className empty props remain.

### Task 8: Verification

**Step 1: Lint**
Run: `npm run lint`
Expect: success.

**Step 2: Typecheck**
Run: `npm run typecheck`
Expect: success.

**Step 3: Spot-check visuals (manual)**
- Inventory Keluar action icons (ghost icon-sm) in dark mode
- Pagination outline buttons in inventory/finance
- Link-style buttons in customer portal

### Task 9: Summarize changes (no commit unless requested)

**Step 1: Prepare summary** of variants applied per domain and verification results.

**Step 2: If commits requested later, stage and commit following repo conventions.**
