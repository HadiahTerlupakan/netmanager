# Button Variant Cleanup (Agent D) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Normalize `<Button>` usage in network and integrations screens so non-default styles use explicit `variant`/`size`, and redundant manual styling is removed.

**Architecture:** UI-only refactor. Update existing React components under network (mikrotik/radius) and integrations (mixradius) to use canonical button variants instead of ad-hoc classes. Avoid excluded shared components.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind via `cn`, shared `components/ui/Button` variants.

---

### Task 1: Audit target files

**Files:**
- Read: `app/admin/network/mikrotik/**/*`
- Read: `components/mikrotik/*.tsx`
- Read: `network/radius/**/*`
- Read: `components/admin/radius/sync-controls.tsx`
- Read: `app/admin/integrations/mixradius/**/*`

**Step 1:** Scan for `<Button>` usages lacking `variant`/`size` or with manual styling.

**Step 2:** Note current intent (primary vs destructive vs ghost/icon) based on text, icon-only, color classes, and context.

**Step 3:** List changes needed per file.

### Task 2: Update Mikrotik network pages and components

**Files:**
- Modify: `app/admin/network/mikrotik/**/*`
- Modify: `components/mikrotik/*.tsx`

**Step 1:** Replace styled `<Button>`s with variants per mapping: destructive for delete, success for positive actions, warning for risky but non-delete, secondary/outline for neutral, ghost for icon-only/text-colored actions, link for text-only; add `size="sm"|"lg"|"icon"|"icon-sm"` when needed.

**Step 2:** Remove redundant tailwind styling already provided by variants (bg/text/hover/rounded/transition/focus/disabled/px/py) while keeping layout classes (gap, flex, width).

**Step 3:** Drop `className` prop if it becomes empty.

**Step 4:** Ensure default buttons stay variant-less/size-less when they should be primary default.

### Task 3: Update Radius (network) components

**Files:**
- Modify: `network/radius/**/*`
- Modify: `components/admin/radius/sync-controls.tsx`

**Step 1:** Apply the same variant/size mapping rules to `<Button>` usages.

**Step 2:** Remove redundant manual styling; keep only layout classes.

**Step 3:** Remove empty `className`.

### Task 4: Update MixRadius integration screens

**Files:**
- Modify: `app/admin/integrations/mixradius/**/*`

**Step 1:** Normalize `<Button>`s for MixRadiusClient, expenses, income-period modal, groups/accounts pages and related components using the mapping rules.

**Step 2:** Clean redundant styling; keep layout classes; remove empty `className`.

### Task 5: Quick verification

**Step 1:** Run lint to ensure no unused imports/types: `npm run lint`.

**Step 2:** If lint is slow, at least run `npm run lint -- --fix` on touched files or rely on type safety during build.

**Step 3:** Manually re-open key files to confirm variant/size choices and no empty className remain.

**Note:** User requested no commits; leave changes staged/unstaged as is.
