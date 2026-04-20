# Attendance Label Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyeragamkan label attendance admin sehingga `ABSENT` tampil sebagai `Tidak Hadir` dan `NO_CHECKOUT` tampil sebagai `Lupa Absen Pulang`, tanpa memutus kompatibilitas data historis.

**Architecture:** Cleanup dilakukan di dua lapis. `lib/attendance-display.ts` menjadi sumber kebenaran untuk label canonical dan tetap mengenali note legacy historical no-checkout. `app/admin/attendance/AttendanceClient.tsx` memakai helper itu untuk badge/status wording, filter, dan CTA sehingga string `Mangkir` tidak lagi muncul di UI canonical.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, file-content consumer tests.

---

## File Structure

- **Modify:** `lib/attendance-display.ts`
  - Tambah helper label canonical untuk status attendance.
  - Pertahankan parser legacy `Auto checkout by system (Mangkir)`.
- **Modify:** `tests/lib/attendance-display.test.ts`
  - Tambah test helper label canonical dan historical no-checkout.
- **Create:** `tests/components/attendance/status-label-consumer.test.ts`
  - Kunci penggunaan helper label di `AttendanceClient.tsx` dan larang wording legacy canonical.
- **Modify:** `app/admin/attendance/AttendanceClient.tsx`
  - Ganti label badge `ABSENT`/`NO_CHECKOUT`, label campuran, dropdown edit/filter, dan CTA backfill.

### Task 1: Tambahkan helper label canonical attendance

**Files:**
- Modify: `lib/attendance-display.ts`
- Test: `tests/lib/attendance-display.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('returns canonical labels for ABSENT and NO_CHECKOUT while preserving historical no-checkout detection', () => {
  expect(
    getCanonicalAttendanceLabel({
      status: 'ABSENT',
      notes: 'Tidak Masuk Kerja (Absent) - Auto Generated',
      checkOut: null,
    }),
  ).toBe('Tidak Hadir')

  expect(
    getCanonicalAttendanceLabel({
      status: 'NO_CHECKOUT',
      notes: ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
      checkOut: '2026-03-27T16:59:59.000Z',
    }),
  ).toBe('Lupa Absen Pulang')

  expect(
    getCanonicalAttendanceLabel({
      status: 'ABSENT',
      notes: 'Auto checkout by system (Mangkir)',
      checkOut: '2026-03-27T16:59:59.000Z',
    }),
  ).toBe('Lupa Absen Pulang')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/lib/attendance-display.test.ts
```

Expected: FAIL karena `getCanonicalAttendanceLabel` belum ada.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getCanonicalAttendanceLabel(input: {
  status?: string | null
  notes?: string | null
  checkOut?: string | Date | null
  displayStatus?: string | null
}): string {
  if (isHistoricalAutoCheckoutAbsence(input)) {
    return input.displayStatus?.trim() || 'Lupa Absen Pulang'
  }

  if (input.status === 'NO_CHECKOUT') {
    return input.displayStatus?.trim() || 'Lupa Absen Pulang'
  }

  if (input.status === 'ABSENT' || input.status === 'ALPHA') {
    return 'Tidak Hadir'
  }

  return ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/lib/attendance-display.test.ts
```

Expected: PASS, semua test helper hijau.

- [ ] **Step 5: Commit**

```bash
git add tests/lib/attendance-display.test.ts lib/attendance-display.ts
git commit -m "fix: add canonical attendance labels"
```

### Task 2: Kunci consumer test untuk wording canonical di AttendanceClient

**Files:**
- Create: `tests/components/attendance/status-label-consumer.test.ts`
- Test: `tests/components/attendance/status-label-consumer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('AttendanceClient status label consumer', () => {
  it('uses canonical attendance label helper and removes legacy mangkir wording from canonical UI labels', () => {
    const content = readFileSync(
      join(process.cwd(), 'app', 'admin', 'attendance', 'AttendanceClient.tsx'),
      'utf8',
    )

    expect(content).toContain('getCanonicalAttendanceLabel')
    expect(content).toContain('Lupa Absen Pulang')
    expect(content).toContain('Tidak Hadir')
    expect(content).toContain('Sync Ketidakhadiran')
    expect(content).not.toContain('Lupa Check-in (Mangkir)')
    expect(content).not.toContain('Sync Mangkir')
    expect(content).not.toMatch(/label:\s*["']Mangkir["']/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/components/attendance/status-label-consumer.test.ts
```

Expected: FAIL karena `AttendanceClient.tsx` masih berisi `Mangkir`, `Sync Mangkir`, dan belum memakai helper baru.

- [ ] **Step 3: Prepare the minimal target UI strings**

Gunakan string canonical berikut saat implementasi di task berikutnya:

```ts
const CANONICAL_LABELS = {
  ABSENT: 'Tidak Hadir',
  NO_CHECKOUT: 'Lupa Absen Pulang',
  BACKFILL_BUTTON: 'Sync Ketidakhadiran',
  BACKFILL_PROMPT:
    'Jalankan proses perbaikan (backfill) presensi ketidakhadiran otomatis?',
  EDIT_ABSENT: 'Tidak Hadir (ABSENT)',
  EDIT_NO_CHECKOUT: 'Lupa Absen Pulang (NO_CHECKOUT)',
}
```

- [ ] **Step 4: Re-run the consumer test after implementation**

Run:
```bash
npm run test:run -- tests/components/attendance/status-label-consumer.test.ts
```

Expected: PASS setelah `AttendanceClient.tsx` memakai helper canonical dan wording lama hilang.

- [ ] **Step 5: Commit**

```bash
git add tests/components/attendance/status-label-consumer.test.ts app/admin/attendance/AttendanceClient.tsx
git commit -m "fix: align attendance labels in admin ui"
```

### Task 3: Terapkan cleanup label di AttendanceClient

**Files:**
- Modify: `app/admin/attendance/AttendanceClient.tsx`
- Test: `tests/components/attendance/status-label-consumer.test.ts`
- Test: `tests/components/attendance/status-filter-consumer.test.ts`
- Test: `tests/lib/attendance-display.test.ts`

- [ ] **Step 1: Write the failing filter wording expectation**

Tambahkan assertion berikut ke `tests/components/attendance/status-filter-consumer.test.ts`:

```ts
expect(content).toContain('<option value="ABSENT">Tidak Hadir</option>')
expect(content).toContain('<option value="NO_CHECKOUT">Lupa Absen Pulang</option>')
expect(content).toContain('<option value="ABSENT">Tidak Hadir (ABSENT)</option>')
expect(content).toContain(
  '<option value="NO_CHECKOUT">Lupa Absen Pulang (NO_CHECKOUT)</option>',
)
expect(content).not.toContain('Alpha (ABSENT)')
expect(content).not.toContain('Tidak Checkout (NO_CHECKOUT)')
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test:run -- tests/components/attendance/status-filter-consumer.test.ts tests/components/attendance/status-label-consumer.test.ts
```

Expected: FAIL karena file masih mengandung `Tidak Checkout (NO_CHECKOUT)`, `Alpha (ABSENT)`, dan CTA `Sync Mangkir`.

- [ ] **Step 3: Write minimal implementation**

Terapkan perubahan minimal berikut di `app/admin/attendance/AttendanceClient.tsx`:

```ts
import {
  getCanonicalAttendanceLabel,
  getDayOffDisplayLabel,
  getPermitDisplayLabel,
  isHistoricalAutoCheckoutAbsence,
} from '@/lib/attendance-display'
```

```ts
ALPHA: {
  bg: 'bg-red-100 dark:bg-red-900/30',
  text: 'text-red-800 dark:text-red-400',
  label: 'Tidak Hadir',
},
ABSENT: {
  bg: 'bg-red-100 dark:bg-red-900/30',
  text: 'text-red-800 dark:text-red-400',
  label: 'Tidak Hadir',
},
NO_CHECKOUT: {
  bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  text: 'text-yellow-800 dark:text-yellow-400',
  label: 'Lupa Absen Pulang',
},
```

```ts
if (isHistoricalNoCheckout) {
  config = {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-400',
    label: getCanonicalAttendanceLabel(item),
  }
} else if (isForgotCheckOut) {
  config = {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-400',
    label: getCanonicalAttendanceLabel({
      ...item,
      status: 'NO_CHECKOUT',
      displayStatus: item.displayStatus,
    }),
  }
} else if (
  !isHistoricalNoCheckout &&
  (isSystemGenerated || isDummyCheckIn) &&
  (item.status === 'ALPHA' || item.status === 'ABSENT' || item.status === 'NO_CHECKOUT')
) {
  config = {
    bg: item.status === 'NO_CHECKOUT'
      ? 'bg-yellow-100 dark:bg-yellow-900/30'
      : 'bg-red-100 dark:bg-red-900/30',
    text: item.status === 'NO_CHECKOUT'
      ? 'text-yellow-800 dark:text-yellow-400'
      : 'text-red-800 dark:text-red-400',
    label: getCanonicalAttendanceLabel(item),
  }
}
```

```tsx
<option value="NO_CHECKOUT">Lupa Absen Pulang</option>
```

```tsx
!confirm(
  'Jalankan proses perbaikan (backfill) presensi ketidakhadiran otomatis?',
)
```

```tsx
Sync Ketidakhadiran
```

```tsx
<option value="ABSENT">Tidak Hadir (ABSENT)</option>
<option value="NO_CHECKOUT">Lupa Absen Pulang (NO_CHECKOUT)</option>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:run -- tests/lib/attendance-display.test.ts tests/components/attendance/status-filter-consumer.test.ts tests/components/attendance/status-label-consumer.test.ts
```

Expected: PASS, label canonical tampil konsisten dan wording legacy hilang dari UI canonical.

- [ ] **Step 5: Commit**

```bash
git add app/admin/attendance/AttendanceClient.tsx tests/components/attendance/status-filter-consumer.test.ts tests/components/attendance/status-label-consumer.test.ts tests/lib/attendance-display.test.ts lib/attendance-display.ts
git commit -m "fix: standardize attendance status labels"
```

### Task 4: Jalankan verifikasi regresi attendance terkait

**Files:**
- Test: `tests/lib/attendance-display.test.ts`
- Test: `tests/components/attendance/status-filter-consumer.test.ts`
- Test: `tests/components/attendance/status-label-consumer.test.ts`
- Test: `tests/components/attendance/day-off-display-consumer.test.ts`
- Test: `tests/components/attendance/permit-display-consumer.test.ts`
- Test: `tests/api/admin-attendance-status-detail-filter.test.ts`

- [ ] **Step 1: Run focused regression suite**

Run:
```bash
npm run test:run -- \
  tests/lib/attendance-display.test.ts \
  tests/components/attendance/status-filter-consumer.test.ts \
  tests/components/attendance/status-label-consumer.test.ts \
  tests/components/attendance/day-off-display-consumer.test.ts \
  tests/components/attendance/permit-display-consumer.test.ts \
  tests/api/admin-attendance-status-detail-filter.test.ts
```

Expected: PASS, tidak ada regresi di helper display atau filter backend.

- [ ] **Step 2: Run one textual guard check**

Run:
```bash
grep -n "Lupa Check-in (Mangkir)\|Sync Mangkir\|label: \"Mangkir\"" app/admin/attendance/AttendanceClient.tsx
```

Expected: tidak ada output.

- [ ] **Step 3: If any test fails, apply the smallest matching fix**

Perbaikan yang diizinkan hanya:

```ts
// helper label canonical
return input.displayStatus?.trim() || 'Lupa Absen Pulang'
```

```ts
// UI status text
label: getCanonicalAttendanceLabel(item)
```

Jangan ubah query backend atau enum Prisma.

- [ ] **Step 4: Re-run the same regression suite**

Run:
```bash
npm run test:run -- \
  tests/lib/attendance-display.test.ts \
  tests/components/attendance/status-filter-consumer.test.ts \
  tests/components/attendance/status-label-consumer.test.ts \
  tests/components/attendance/day-off-display-consumer.test.ts \
  tests/components/attendance/permit-display-consumer.test.ts \
  tests/api/admin-attendance-status-detail-filter.test.ts
```

Expected: PASS bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/attendance-display.ts app/admin/attendance/AttendanceClient.tsx tests/lib/attendance-display.test.ts tests/components/attendance/status-filter-consumer.test.ts tests/components/attendance/status-label-consumer.test.ts
git commit -m "test: cover canonical attendance labels"
```
