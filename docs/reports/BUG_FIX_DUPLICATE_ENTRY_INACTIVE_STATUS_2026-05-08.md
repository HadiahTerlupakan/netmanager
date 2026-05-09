# Bug Fix: DUPLICATE_ENTRY pada Check-In dengan Record Inactive

**Tanggal:** 2026-05-08  
**Reporter:** User (via production logs)  
**Severity:** High  
**Status:** Fixed  

---

## Executive Summary

Bug terjadi pada karyawan dengan `workingHourMode = "FIXED"` yang memiliki record attendance auto-generated dengan status `ABSENT` atau `DAY_OFF`. Endpoint `/api/mobile/attendance/status` mengembalikan `status: "idle"`, tetapi saat user melakukan check-in, sistem throw error `DUPLICATE_ENTRY` / `ALREADY_CHECKED_IN`.

**Root Cause:** `buildUserOpenSessionWhere()` di `AttendanceSessionRepository` tidak memfilter status inactive (ABSENT, DAY_OFF, PERMIT, SICK, ALPHA), menyebabkan record auto-generated dianggap sebagai "open session" oleh guard.

**Fix Applied:** Tambahkan filter `status: { notIn: AUTO_CHECKOUT_INACTIVE_STATUSES }` ke `buildUserOpenSessionWhere()`.

---

## Production Evidence

### Log Error
```
[2026-05-08T16:06:25.784Z] GET /api/mobile/attendance/status 200 (42ms)
[2026-05-08T16:06:37.891Z] POST /api/mobile/attendance/check-in
[2026-05-08T16:06:38.012Z] ERROR MobileCheckInRouteService: Check-in error
Error: DUPLICATE_ENTRY
  at Object.assertNoActiveSessionConflict (AttendanceSessionGuardService.ts:84)
[2026-05-08T16:06:38.012Z] WARN Mobile check-in failed
  error: "Anda sudah melakukan check-in hari ini"
  code: "ALREADY_CHECKED_IN"
  status: 400
```

**User:** `30295943-fab8-4fbd-8b33-e4a08260a791` (wisnu@sblnet.id)  
**Role:** Teknisi  
**Working Hour Mode:** FIXED (09:00 - 17:00)

### Data Attendance Aktual

Query database menunjukkan user memiliki 3 record open (checkOut = null):

```json
[
  {
    "id": "a6e87adf-7c69-417d-a7a4-4880a0eadef9",
    "checkIn": "2026-05-07T17:00:00.000Z",
    "checkOut": null,
    "status": "ABSENT",
    "checkInDate": null,
    "correctedAt": null,
    "notes": "Tidak Masuk Kerja (Absent) - Auto Generated"
  },
  {
    "id": "81aa44f9-5bf2-4016-a000-10c6948e245e",
    "checkIn": "2026-05-06T17:00:00.000Z",
    "checkOut": null,
    "status": "DAY_OFF",
    "checkInDate": null,
    "correctedAt": null,
    "notes": "Hari Off (Day Off) - Auto Generated"
  },
  {
    "id": "56e06871-6bed-4543-81ed-7cf742eac994",
    "checkIn": "2026-05-05T17:00:00.000Z",
    "checkOut": null,
    "status": "ABSENT",
    "checkInDate": null,
    "correctedAt": null,
    "notes": "Tidak Masuk Kerja (Absent) - Auto Generated"
  }
]
```

**Key Observation:** Record auto-generated (ABSENT, DAY_OFF) memiliki `checkOut = null` karena tidak ada aktivitas check-in/check-out yang sebenarnya.

---

## Root Cause Analysis

### Skenario Bug

1. **Sistem auto-generate record ABSENT** untuk hari kemarin (2026-05-07) karena user tidak check-in
2. Record ABSENT memiliki `checkOut = null` (bukan sesi aktif, hanya marker administratif)
3. **User coba check-in hari ini** (2026-05-08)
4. `AttendanceSessionGuardService.assertNoActiveSessionConflict()` dipanggil
5. Guard query `findFirstOpenSession()` yang menggunakan `buildUserOpenSessionWhere()`
6. **Query menemukan record ABSENT kemarin** karena `checkOut = null`
7. Guard throw `DUPLICATE_ENTRY`

### Code Flow

**AttendanceSessionGuardService.ts (line 48-86):**
```typescript
async assertNoActiveSessionConflict(input: {
  userId: string;
  userDetails: CachedUserAttendanceSettings | null;
  checkInTime: Date;
  timezone: string;
  tenantId?: string;
}) {
  const latestOpenAttendance =
    (await this.attendanceRepo.findFirstOpenSession({
      userId: input.userId,
      tenantId: input.tenantId,
    })) as ActiveAttendanceSessionRow | null;
  
  if (!latestOpenAttendance) return; // ← Seharusnya return di sini
  
  // ... policy evaluation ...
  
  if (isSessionStillActive) {
    throw new Error("DUPLICATE_ENTRY"); // ← Throw error karena menemukan record ABSENT
  }
}
```

**AttendanceSessionRepository.ts (SEBELUM FIX):**
```typescript
private buildUserOpenSessionWhere(input: {
  userId: string;
  tenantId?: string;
}): Prisma.AttendanceWhereInput {
  return {
    userId: input.userId,
    checkOut: null,           // ← Menemukan ABSENT/DAY_OFF
    correctedAt: null,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    // ❌ TIDAK ADA FILTER STATUS
  };
}
```

**Bandingkan dengan `buildOpenSessionWhere()` (line 130-149):**
```typescript
private buildOpenSessionWhere(input: {
  endOfToday: Date;
  twentyFourHoursAgo: Date;
  tenantId?: string;
}): Prisma.AttendanceWhereInput {
  return {
    checkOut: null,
    correctedAt: null,
    checkIn: { lte: input.endOfToday },
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    status: { notIn: [...getInactiveSessionStatuses()] }, // ✅ ADA FILTER STATUS
    // ...
  };
}
```

**Inkonsistensi:**
- `buildOpenSessionWhere()` → filter status inactive ✅
- `findManyStaleSessions()` → filter status inactive ✅
- `buildUserOpenSessionWhere()` → **TIDAK** filter status inactive ❌

### Kenapa Baru Muncul Sekarang?

Bug ini hanya terjadi pada user yang:
1. Punya record auto-generated (ABSENT/DAY_OFF) dengan `checkOut = null`
2. Coba check-in setelah record tersebut dibuat
3. Record belum di-correct/update oleh admin

Sebelumnya mungkin:
- User selalu check-in setiap hari (tidak ada ABSENT)
- Record ABSENT sudah di-correct oleh admin (correctedAt != null)
- Sistem belum generate record auto untuk hari off

---

## Solution Applied

### Fix: AttendanceSessionRepository.ts

**File:** `modules/attendance/repositories/AttendanceSessionRepository.ts`  
**Line:** 164-174

**Sebelum:**
```typescript
private buildUserOpenSessionWhere(input: {
  userId: string;
  tenantId?: string;
}): Prisma.AttendanceWhereInput {
  return {
    userId: input.userId,
    checkOut: null,
    correctedAt: null,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  };
}
```

**Sesudah:**
```typescript
private buildUserOpenSessionWhere(input: {
  userId: string;
  tenantId?: string;
}): Prisma.AttendanceWhereInput {
  return {
    userId: input.userId,
    checkOut: null,
    correctedAt: null,
    status: { notIn: [...AUTO_CHECKOUT_INACTIVE_STATUSES] }, // ← TAMBAHAN
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  };
}
```

**AUTO_CHECKOUT_INACTIVE_STATUSES:**
```typescript
const AUTO_CHECKOUT_INACTIVE_STATUSES = [
  "ALPHA",
  "ABSENT",
  "DAY_OFF",
  "PERMIT",
  "SICK",
] as const;
```

### Affected Methods

1. **`findFirstOpenSession()`** (line 51-65)
   - Digunakan oleh: `AttendanceSessionGuardService.assertNoActiveSessionConflict()`
   - Impact: Guard tidak lagi menemukan record ABSENT/DAY_OFF sebagai open session

2. **`findFirstActiveForCheckout()`** (line 83-101)
   - Digunakan oleh: Checkout flow
   - Impact: Checkout tidak akan mencoba close record ABSENT/DAY_OFF

### Test Updates

**File:** `tests/modules/attendance/repositories/AttendanceSessionRepository.test.ts`

Update 3 test case untuk menyertakan filter status inactive di ekspektasi:
- `findFirstOpenSession` → "harus memfilter correctedAt: null untuk mengabaikan attendance terkoreksi"
- `findFirstOpenSession` → "harus memfilter correctedAt: null tanpa tenantId"
- `findFirstActiveForCheckout` → "harus memfilter correctedAt: null untuk checkout"

**Test Result:**
```
Test Files  1 passed (1)
Tests       7 passed (7)
Duration    211ms
```

**Full Test Suite:**
```
Test Files  484 passed (484)
Tests       2384 passed | 7 skipped (2391)
Duration    125.33s
```

---

## Verification

### Before Fix

**Query yang dijalankan guard:**
```sql
SELECT * FROM "Attendance"
WHERE "userId" = '30295943-fab8-4fbd-8b33-e4a08260a791'
  AND "checkOut" IS NULL
  AND "correctedAt" IS NULL
  AND "tenantId" = '0c33470a-0a95-4770-b083-a52598c490a3'
ORDER BY "checkIn" DESC
LIMIT 1;
```

**Result:** Menemukan record ABSENT kemarin → throw DUPLICATE_ENTRY ❌

### After Fix

**Query yang dijalankan guard:**
```sql
SELECT * FROM "Attendance"
WHERE "userId" = '30295943-fab8-4fbd-8b33-e4a08260a791'
  AND "checkOut" IS NULL
  AND "correctedAt" IS NULL
  AND "status" NOT IN ('ALPHA', 'ABSENT', 'DAY_OFF', 'PERMIT', 'SICK')
  AND "tenantId" = '0c33470a-0a95-4770-b083-a52598c490a3'
ORDER BY "checkIn" DESC
LIMIT 1;
```

**Result:** Tidak menemukan record (ABSENT di-filter) → allow check-in ✅

---

## Prevention Measures

### 1. Konsistensi Query Builder

Semua query builder yang mencari "open session" harus menggunakan filter status yang sama:

```typescript
// ✅ GOOD - Konsisten
const baseOpenSessionWhere = {
  checkOut: null,
  correctedAt: null,
  status: { notIn: [...AUTO_CHECKOUT_INACTIVE_STATUSES] },
};
```

**Rekomendasi:** Extract ke shared constant atau helper function.

### 2. Test Coverage untuk Edge Case

Tambahkan test case untuk skenario:
- User dengan record ABSENT auto-generated coba check-in
- User dengan record DAY_OFF coba check-in
- User dengan multiple inactive records

### 3. Code Review Checklist

Saat menambah query attendance:
- [ ] Apakah query ini mencari "open session"?
- [ ] Apakah sudah filter `correctedAt: null`?
- [ ] Apakah sudah filter status inactive?
- [ ] Apakah konsisten dengan query builder lain?

### 4. Monitoring

Tambahkan monitoring untuk:
- Jumlah record ABSENT/DAY_OFF dengan `checkOut = null`
- Frekuensi error DUPLICATE_ENTRY per user
- User yang punya multiple open sessions

---

## Related Files

- `modules/attendance/repositories/AttendanceSessionRepository.ts` (Fixed)
- `modules/attendance/services/AttendanceSessionGuardService.ts` (Caller)
- `tests/modules/attendance/repositories/AttendanceSessionRepository.test.ts` (Updated)

---

## Deployment

**Commit:** `b22071eb`  
**Branch:** `staging`  
**Pushed:** 2026-05-08T16:16:00Z

**Deployment Steps:**
1. Jenkins CI/CD akan auto-deploy ke staging environment
2. Idempotent migrations akan run (tidak ada schema change)
3. Pod restart dengan image baru
4. Verify dengan user wisnu@sblnet.id

---

## Conclusion

Bug ini disebabkan oleh **inkonsistensi filter status** antara query builder yang berbeda di `AttendanceSessionRepository`.

**Root Cause:**
- `buildUserOpenSessionWhere()` tidak filter status inactive
- Record auto-generated (ABSENT, DAY_OFF) dengan `checkOut = null` dianggap sebagai open session
- Guard throw DUPLICATE_ENTRY karena menemukan "open session" yang sebenarnya bukan sesi aktif

**Fix yang diterapkan:**
- Tambahkan filter `status: { notIn: AUTO_CHECKOUT_INACTIVE_STATUSES }` ke `buildUserOpenSessionWhere()`
- Update test expectations untuk konsistensi
- Semua test pass (484 files, 2384 tests)

Dengan fix ini:
- Record ABSENT/DAY_OFF tidak lagi dianggap sebagai open session
- User bisa check-in normal meskipun punya record auto-generated kemarin
- Query builder konsisten di seluruh repository

**Lesson Learned:**
- Selalu gunakan filter status yang sama untuk semua query "open session"
- Test dengan data produksi yang mencakup edge case (auto-generated records)
- Code review harus check konsistensi query builder
