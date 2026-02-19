# Sidebar Admin Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Memperbarui tampilan `Sidebar` admin agar lebih clean-professional dengan UX ringan, tanpa mengubah logic menu/permission/routing.

**Architecture:** Pertahankan struktur dan behavior komponen existing di `components/layout/Sidebar.tsx`, lalu refactor kelas styling menjadi token/helper kecil agar state visual lebih konsisten dan mudah dites. Perubahan dibatasi pada presentational layer (spacing, hierarchy, active/hover/focus, mobile consistency) sehingga risiko regresi fungsional rendah.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Vitest.

---

### Task 1: Buat helper style yang bisa diuji

**Files:**
- Create: `components/layout/sidebar-admin-styles.ts`
- Test: `components/layout/sidebar-admin-styles.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  getParentItemClass,
  getChildItemClass,
  getSectionHeaderClass,
} from './sidebar-admin-styles'

describe('sidebar admin styles', () => {
  it('returns active class for parent', () => {
    const className = getParentItemClass({ isActive: true, hasActiveChild: false })
    expect(className).toContain('bg-slate-900')
  })

  it('returns active class for child', () => {
    const className = getChildItemClass({ isActive: true })
    expect(className).toContain('text-slate-900')
  })

  it('returns consistent section header class', () => {
    expect(getSectionHeaderClass()).toContain('tracking-[0.16em]')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: FAIL karena module/helper belum ada.

**Step 3: Write minimal implementation**

```ts
type ParentState = { isActive: boolean; hasActiveChild: boolean }
type ChildState = { isActive: boolean }

export function getParentItemClass(state: ParentState): string {
  if (state.isActive || state.hasActiveChild) {
    return 'bg-slate-900 text-white'
  }
  return 'text-slate-600 hover:bg-slate-100'
}

export function getChildItemClass(state: ChildState): string {
  if (state.isActive) {
    return 'text-slate-900 bg-slate-100'
  }
  return 'text-slate-500 hover:text-slate-800'
}

export function getSectionHeaderClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400'
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/layout/sidebar-admin-styles.ts components/layout/sidebar-admin-styles.test.ts
git commit -m "test: add sidebar admin style helper coverage"
```

### Task 2: Terapkan visual refresh pada Sidebar header dan container

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Test: `components/layout/sidebar-admin-styles.test.ts`

**Step 1: Write the failing test**

Tambahkan test untuk token class baru yang dipakai header/container agar konsisten.

```ts
import { getContainerClass, getBrandBadgeClass } from './sidebar-admin-styles'

it('uses refined container class', () => {
  expect(getContainerClass()).toContain('bg-slate-50/80')
})

it('uses subtle brand badge class', () => {
  expect(getBrandBadgeClass()).toContain('text-slate-500')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: FAIL (function baru belum ada).

**Step 3: Write minimal implementation**

- Tambah function helper yang dibutuhkan di `sidebar-admin-styles.ts`
- Ubah kelas di `Sidebar.tsx` untuk:
  - container `aside`
  - logo/brand block
  - badge "Admin Portal"
  - mobile close button visual

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/sidebar-admin-styles.ts components/layout/sidebar-admin-styles.test.ts
git commit -m "feat: refresh sidebar admin container and brand hierarchy"
```

### Task 3: Terapkan visual refresh pada nav parent/child + focus states

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/sidebar-admin-styles.ts`
- Test: `components/layout/sidebar-admin-styles.test.ts`

**Step 1: Write the failing test**

Tambahkan test untuk class parent/child/focus state agar active dan hover hierarchy konsisten.

```ts
it('includes keyboard focus style for parent item', () => {
  const className = getParentItemClass({ isActive: false, hasActiveChild: false })
  expect(className).toContain('focus-visible:ring-2')
})

it('includes child active emphasis', () => {
  const className = getChildItemClass({ isActive: true })
  expect(className).toContain('font-semibold')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

- Perbarui helper class untuk parent/child default-hover-active-focus
- Terapkan class baru pada:
  - parent menu button
  - child menu link
  - active indicator
  - section header

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/sidebar-admin-styles.ts components/layout/sidebar-admin-styles.test.ts
git commit -m "feat: improve sidebar admin navigation hierarchy and focus states"
```

### Task 4: Rapikan profile footer dan validasi akhir

**Files:**
- Modify: `components/layout/Sidebar.tsx`

**Step 1: Write the failing test**

Tambahkan assertion class profile footer pada `sidebar-admin-styles.test.ts` (jika helper dipakai), misalnya token untuk card border/spacing.

```ts
import { getProfileCardClass } from './sidebar-admin-styles'

it('uses refined profile card class', () => {
  expect(getProfileCardClass()).toContain('rounded-2xl')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: FAIL jika helper belum ditambahkan.

**Step 3: Write minimal implementation**

- Terapkan style footer/profile agar lebih clean dan konsisten
- Pastikan logout button tetap jelas dan accessible

**Step 4: Run verification commands**

Run: `npm run test:run -- components/layout/sidebar-admin-styles.test.ts`
Expected: PASS.

Run: `npm run lint -- components/layout/Sidebar.tsx components/layout/sidebar-admin-styles.ts components/layout/sidebar-admin-styles.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/sidebar-admin-styles.ts components/layout/sidebar-admin-styles.test.ts
git commit -m "feat: finalize clean professional sidebar admin refresh"
```

### Task 5: Manual QA desktop dan mobile

**Files:**
- Modify (if needed): `components/layout/Sidebar.tsx`

**Step 1: Run app**

Run: `npm run dev`
Expected: app berjalan normal.

**Step 2: Verify desktop states**

- Cek menu default, hover, active, expanded
- Cek parent aktif vs child aktif
- Cek section header readability

**Step 3: Verify mobile states**

- Cek drawer open/close
- Cek overlay click close
- Cek route-change auto-close

**Step 4: Final check**

Run: `npm run check`
Expected: PASS (lint + typecheck + build).

**Step 5: Commit (if QA fixes were needed)**

```bash
git add components/layout/Sidebar.tsx
git commit -m "fix: polish sidebar admin interactions after manual QA"
```
