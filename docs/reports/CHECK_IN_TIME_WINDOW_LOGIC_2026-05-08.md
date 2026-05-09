# Logika Waktu Check-In untuk Mode FIXED dan SHIFT

**Tanggal:** 2026-05-08  
**Tujuan:** Dokumentasi lengkap tentang kapan check-in dibolehkan/ditolak untuk karyawan FIXED dan SHIFT

---

## Executive Summary

Sistem attendance saat ini **TIDAK memvalidasi window waktu check-in** untuk mobile check-in. Validasi hanya dilakukan untuk:
1. Cuti/izin aktif (LEAVE)
2. Hari libur (HOLIDAY)
3. Hari off/bukan jadwal kerja (OFF_DAY)

**Window waktu check-in (3 jam sebelum jam kerja sampai jam akhir kerja) HANYA diterapkan pada fitur koreksi manual admin**, bukan pada check-in mobile real-time.

---

## Flow Check-In Mobile (Real-time)

### 1. Entry Point
**File:** `app/api/mobile/attendance/check-in/route.ts`

```typescript
export const POST = createHandler({ auth: true }, async (request, ctx) => {
  const result = await mobileAttendanceCheckInRouteService.checkIn({
    request,
    user: ctx.session!.user,
  });
  // ... handle result
});
```

### 2. Route Service Layer
**File:** `modules/attendance/services/MobileAttendanceCheckInRouteService.ts`

```typescript
async checkIn(input: MobileCheckInRouteInput): Promise<MobileAttendanceCheckInRouteResult> {
  // 1. Parse payload (photo, location, coordinates)
  const parsedPayload = await this.payloadParser.parsePayload(input.request, userId);
  
  // 2. Idempotency check
  const idempotencyResult = await this.idempotencyService.begin({...});
  
  // 3. Perform actual check-in
  const result = await this.attendance.checkIn({
    userId: input.userId,
    photoUrl: payload.photoUrl,
    location: payload.location,
    timezone: timezone,
    tenantId: tenantId,
    // ... other params
  });
  
  return { success: true, data: responsePayload };
}
```

**Catatan:** Tidak ada validasi window waktu di layer ini.

### 3. Mutation Service Layer
**File:** `modules/attendance/services/AttendanceMutationService.ts` (line 44-80)

```typescript
async checkIn(params: CheckInParams) {
  // 1. Validate coordinates
  this.validateCoordinates(params.latitude, params.longitude);
  
  // 2. Prepare context (timezone, eligibility, user details)
  const context = await this.prepareCheckInContext(params);
  
  // 3. Auto-checkout sesi lama jika ada
  await this.sessionGuardService.processAutoCheckout({...});
  
  // 4. Assert tidak ada sesi aktif yang conflict
  await this.sessionGuardService.assertNoActiveSessionConflict({...});
  
  // 5. Resolve geofence
  const geofenceResult = await this.geofenceService.resolveCheckInGeofence(...);
  
  // 6. Resolve status (ON_TIME vs LATE)
  const status = await resolveCheckInStatus({...});
  
  // 7. Create attendance record
  const result = await this.createCheckInAttendance(...);
  
  // 8. Publish event
  this.eventService.publishCheckInEvent(...);
  
  return { attendance: result, evaluation: ... };
}
```

### 4. Validation Service (Eligibility Check)
**File:** `modules/attendance/services/AttendanceValidationService.ts` (line 140-190)

```typescript
async validateCheckInEligibility(
  userId: string,
  timezone: string,
  date: Date = new Date(),
  tenantId?: string,
): Promise<{
  isValid: boolean;
  reason?: string;
  type?: "LEAVE" | "HOLIDAY" | "OFF_DAY";
}> {
  // 1. Check active leave
  const activeLeave = await this.leaveRepo.findActiveLeaveForUserOnDate(...);
  if (activeLeave) {
    return {
      isValid: false,
      reason: `Anda sedang cuti/izin: ${activeLeave.type}`,
      type: "LEAVE",
    };
  }
  
  // 2. Get day metadata (holiday, off-day, tukar libur)
  const dayMetadata = await this.getAttendanceDayMetadata(...);
  
  // 3. Check holiday
  if (dayMetadata.isHoliday) {
    return {
      isValid: false,
      reason: `Hari ini adalah hari libur: ${dayMetadata.holidayName}`,
      type: "HOLIDAY",
    };
  }
  
  // 4. Check off-day
  if (dayMetadata.isOffDay) {
    return {
      isValid: false,
      reason: "Hari ini bukan jadwal kerja Anda",
      type: "OFF_DAY",
    };
  }
  
  // ❌ TIDAK ADA VALIDASI WINDOW WAKTU CHECK-IN
  return { isValid: true };
}
```

**Validasi yang dilakukan:**
- ✅ Cuti/izin aktif
- ✅ Hari libur nasional/tenant
- ✅ Hari off (bukan jadwal kerja)
- ❌ **TIDAK** validasi window waktu (3 jam sebelum jam kerja)

### 5. Status Calculation (ON_TIME vs LATE)
**File:** `modules/attendance/services/attendance-service-helpers.ts` (line 209-231)

```typescript
export async function resolveCheckInStatus(input: {
  checkInTime: Date;
  timezone: string;
  userDetails: CachedUserAttendanceSettings | null;
  timezoneService: AttendanceTimezoneService;
}): Promise<AttendanceStatus> {
  // FLEXIBLE mode selalu ON_TIME
  if (input.userDetails?.workingHourMode === "FLEXIBLE") return "ON_TIME";
  
  // Get schedule time (FIXED: startWorkTime, SHIFT: shift.startTime)
  const scheduleTime = getCheckInScheduleTime(input.userDetails);
  if (!scheduleTime) return "ON_TIME";
  
  // Calculate status based on schedule
  return input.timezoneService.calculateStatus(
    input.checkInTime,
    scheduleTime,
    input.timezone,
  );
}

function getCheckInScheduleTime(userDetails: CachedUserAttendanceSettings | null) {
  return userDetails?.workingHourMode === "SHIFT"
    ? userDetails.shift?.startTime      // SHIFT: gunakan shift.startTime
    : userDetails?.startWorkTime;       // FIXED: gunakan startWorkTime
}
```

**Fungsi ini hanya menghitung status:**
- Check-in sebelum `scheduleTime` → `ON_TIME`
- Check-in setelah `scheduleTime` → `LATE`
- **TIDAK menolak** check-in yang terlalu awal atau terlalu malam

---

## Flow Koreksi Manual Admin (Dengan Window Validation)

### 1. Correction Service
**File:** `modules/attendance/services/AttendanceCorrectionService.ts`

```typescript
async correctMissedCheckIn(input: CorrectionInput) {
  // 1. Find source attendance (ABSENT/DAY_OFF record)
  const sourceAttendance = await this.repo.findSourceForCorrection(...);
  
  // 2. Resolve schedule (FIXED: startWorkTime/endWorkTime, SHIFT: shift times)
  const schedule = await this.scheduleService.resolveSchedule(sourceAttendance);
  
  // 3. Build schedule window dengan 3 jam buffer
  const { windowStart, windowEnd } = this.scheduleService.buildScheduleWindow(
    workDate,
    schedule,
    timezone,
  );
  
  // 4. Assert check-in within window
  this.scheduleService.assertCheckInWithinWindow(
    input.checkIn,
    windowStart,
    windowEnd,
  );
  
  // 5. Create corrected attendance record
  // ...
}
```

### 2. Schedule Service (Window Validation)
**File:** `modules/attendance/services/AttendanceCorrectionScheduleService.ts` (line 19-67)

```typescript
const CHECK_IN_WINDOW_HOURS = 3;

/** Bangun window jadwal koreksi berdasarkan tanggal kerja dan timezone. */
buildScheduleWindow(
  workDate: Date,
  schedule: CorrectionSchedule,
  timezone: string,
) {
  const startAt = this.buildClockTime(workDate, schedule.startTime, timezone);
  let endAt = this.buildClockTime(workDate, schedule.endTime, timezone);
  
  // Handle overnight shift
  if (!isAfter(endAt, startAt)) endAt = addDays(endAt, 1);
  
  return {
    startAt,
    endAt,
    windowStart: subHours(startAt, CHECK_IN_WINDOW_HOURS), // 3 jam sebelum
  };
}

/** Validasi check-in berada dalam window koreksi. */
assertCheckInWithinWindow(checkIn: Date, windowStart: Date, windowEnd: Date) {
  if (isBefore(checkIn, windowStart) || isAfter(checkIn, windowEnd)) {
    throw new ValidationError(
      "Jam check-in berada di luar jendela koreksi yang diizinkan",
    );
  }
}
```

**Window yang diterapkan:**
- **Window Start:** 3 jam sebelum jam mulai kerja/shift
- **Window End:** Jam akhir kerja/shift
- **Contoh FIXED (09:00-17:00):** Window = 06:00 - 17:00
- **Contoh SHIFT (22:00-06:00):** Window = 19:00 (hari ini) - 06:00 (besok)

---

## Perbandingan: Mobile Check-In vs Admin Correction

| Aspek | Mobile Check-In | Admin Correction |
|-------|----------------|------------------|
| **Window Validation** | ❌ Tidak ada | ✅ Ada (3 jam sebelum - akhir kerja) |
| **Leave Validation** | ✅ Ada | ✅ Ada |
| **Holiday Validation** | ✅ Ada | ✅ Ada |
| **Off-Day Validation** | ✅ Ada | ✅ Ada |
| **Geofence Validation** | ✅ Ada | ❌ Tidak ada (manual) |
| **Status Calculation** | ✅ ON_TIME/LATE | ✅ ON_TIME/LATE |
| **Reject Too Early** | ❌ Tidak | ✅ Ya (< 3 jam sebelum) |
| **Reject Too Late** | ❌ Tidak | ✅ Ya (> jam akhir kerja) |

---

## Skenario Praktis

### Skenario 1: Karyawan FIXED (09:00-17:00)

**Mobile Check-In:**
- 05:00 → ✅ **Diterima**, status: ON_TIME
- 06:00 → ✅ **Diterima**, status: ON_TIME
- 08:59 → ✅ **Diterima**, status: ON_TIME
- 09:01 → ✅ **Diterima**, status: LATE
- 16:00 → ✅ **Diterima**, status: LATE
- 20:00 → ✅ **Diterima**, status: LATE
- 23:59 → ✅ **Diterima**, status: LATE

**Admin Correction:**
- 05:00 → ❌ **Ditolak** (< 06:00, terlalu awal)
- 06:00 → ✅ **Diterima**, status: ON_TIME
- 08:59 → ✅ **Diterima**, status: ON_TIME
- 09:01 → ✅ **Diterima**, status: LATE
- 16:00 → ✅ **Diterima**, status: LATE
- 17:01 → ❌ **Ditolak** (> 17:00, terlalu malam)
- 20:00 → ❌ **Ditolak** (> 17:00, terlalu malam)

### Skenario 2: Karyawan SHIFT (22:00-06:00)

**Mobile Check-In:**
- 18:00 → ✅ **Diterima**, status: ON_TIME
- 19:00 → ✅ **Diterima**, status: ON_TIME
- 21:59 → ✅ **Diterima**, status: ON_TIME
- 22:01 → ✅ **Diterima**, status: LATE
- 02:00 → ✅ **Diterima**, status: LATE
- 06:00 → ✅ **Diterima**, status: LATE
- 08:00 → ✅ **Diterima**, status: LATE

**Admin Correction:**
- 18:00 → ❌ **Ditolak** (< 19:00, terlalu awal)
- 19:00 → ✅ **Diterima**, status: ON_TIME
- 21:59 → ✅ **Diterima**, status: ON_TIME
- 22:01 → ✅ **Diterima**, status: LATE
- 02:00 → ✅ **Diterima**, status: LATE
- 06:00 → ✅ **Diterima**, status: LATE
- 06:01 → ❌ **Ditolak** (> 06:00, terlalu malam)

### Skenario 3: Karyawan FLEXIBLE

**Mobile Check-In:**
- Kapan saja → ✅ **Diterima**, status: selalu ON_TIME
- Tidak ada batasan waktu
- Hanya validasi: leave, holiday, off-day

**Admin Correction:**
- Tidak ada fitur koreksi untuk FLEXIBLE (tidak ada ABSENT auto-generated)

---

## Kesimpulan

### Perilaku Saat Ini

1. **Mobile check-in (real-time):**
   - Tidak ada batasan waktu check-in
   - Karyawan bisa check-in kapan saja (bahkan jam 3 pagi atau jam 11 malam)
   - Sistem hanya menghitung status ON_TIME vs LATE
   - Validasi hanya untuk: cuti, libur, hari off

2. **Admin correction (manual):**
   - Ada batasan window: 3 jam sebelum jam kerja sampai jam akhir kerja
   - Reject check-in yang terlalu awal atau terlalu malam
   - Sesuai dengan spec di `docs/superpowers/plans/2026-04-19-attendance-missed-checkin-correction-implementation.md`

### Implikasi

**Kelebihan perilaku saat ini:**
- Fleksibel untuk karyawan yang lupa check-in
- Tidak ada false rejection untuk edge case (misal: lembur malam, shift tidak terduga)
- Sistem tetap record semua aktivitas

**Kekurangan perilaku saat ini:**
- Karyawan bisa check-in di waktu yang tidak masuk akal (jam 3 pagi untuk shift 09:00)
- Tidak ada proteksi terhadap check-in yang salah tanggal
- Data attendance bisa jadi tidak akurat untuk laporan

### Rekomendasi

**Opsi 1: Tetap seperti sekarang (No Window Validation)**
- Pro: Fleksibel, tidak ada false rejection
- Con: Data bisa tidak akurat, abuse potential
- Use case: Perusahaan dengan jam kerja sangat fleksibel

**Opsi 2: Implementasi Window Validation untuk Mobile Check-In**
- Pro: Data lebih akurat, konsisten dengan admin correction
- Con: Perlu handle edge case (lembur, shift mendadak)
- Use case: Perusahaan dengan jam kerja strict

**Opsi 3: Soft Warning (Tidak Reject, Hanya Warning)**
- Pro: Balance antara fleksibilitas dan akurasi
- Con: Perlu UI untuk tampilkan warning
- Use case: Perusahaan yang ingin edukasi karyawan tanpa blocking

---

## Implementasi Window Validation (Jika Diperlukan)

Jika ingin implementasi window validation untuk mobile check-in, berikut langkah-langkahnya:

### 1. Tambahkan Method di AttendanceValidationService

```typescript
// File: modules/attendance/services/AttendanceValidationService.ts

async validateCheckInTimeWindow(
  userId: string,
  checkInTime: Date,
  timezone: string,
  tenantId?: string,
): Promise<{
  isValid: boolean;
  reason?: string;
  type?: "TOO_EARLY" | "TOO_LATE";
}> {
  const user = await this.getUserSchedule(userId, tenantId);
  if (!user || user.workingHourMode === "FLEXIBLE") {
    return { isValid: true }; // FLEXIBLE tidak ada window
  }
  
  const scheduleTime = user.workingHourMode === "SHIFT"
    ? { start: user.shift?.startTime, end: user.shift?.endTime }
    : { start: user.startWorkTime, end: user.endWorkTime };
  
  if (!scheduleTime.start || !scheduleTime.end) {
    return { isValid: true }; // Tidak ada jadwal, allow
  }
  
  const workDate = toStartOfDay(checkInTime, timezone);
  const windowStart = subHours(
    this.buildClockTime(workDate, scheduleTime.start, timezone),
    3
  );
  const windowEnd = this.buildClockTime(workDate, scheduleTime.end, timezone);
  
  if (isBefore(checkInTime, windowStart)) {
    return {
      isValid: false,
      reason: `Check-in terlalu awal. Waktu check-in paling awal: ${format(windowStart, 'HH:mm', { timeZone: timezone })}`,
      type: "TOO_EARLY",
    };
  }
  
  if (isAfter(checkInTime, windowEnd)) {
    return {
      isValid: false,
      reason: `Check-in terlalu malam. Waktu check-in paling akhir: ${format(windowEnd, 'HH:mm', { timeZone: timezone })}`,
      type: "TOO_LATE",
    };
  }
  
  return { isValid: true };
}
```

### 2. Panggil di prepareCheckInContext

```typescript
// File: modules/attendance/services/AttendanceMutationService.ts

private async prepareCheckInContext(params: CheckInParams) {
  const timeContext = await resolveCheckInTimeContext({...});
  
  // Existing validation
  const eligibility = await this.validationService.validateCheckInEligibility(...);
  if (!eligibility.isValid)
    throw new Error(`CHECKIN_REJECTED:${eligibility.reason}`);
  
  // NEW: Window validation
  const windowCheck = await this.validationService.validateCheckInTimeWindow(
    params.userId,
    timeContext.checkInTime,
    timeContext.timezone,
    params.tenantId,
  );
  if (!windowCheck.isValid)
    throw new Error(`CHECKIN_REJECTED:${windowCheck.reason}`);
  
  const userDetails = await getCachedUserAttendanceSettings({...});
  return { ...timeContext, userDetails };
}
```

### 3. Handle Error di Route Service

```typescript
// File: modules/attendance/services/MobileAttendanceCheckInRouteService.ts

private mapCheckInError(error: unknown): MobileAttendanceCheckInRouteResult {
  if (!(error instanceof Error)) throw error;
  
  // ... existing error handlers
  
  if (error.message.startsWith("CHECKIN_REJECTED:")) {
    const reason = error.message.split(":")[1];
    return this.fail(
      `Check-in ditolak: ${reason}`,
      ErrorCodes.VALIDATION_ERROR,
      400,
      { reason },
    );
  }
  
  throw error;
}
```

---

## Testing Checklist

Jika implementasi window validation dilakukan:

- [ ] Test FIXED mode: check-in 3 jam sebelum jam kerja (should pass)
- [ ] Test FIXED mode: check-in 4 jam sebelum jam kerja (should reject)
- [ ] Test FIXED mode: check-in di jam akhir kerja (should pass)
- [ ] Test FIXED mode: check-in setelah jam akhir kerja (should reject)
- [ ] Test SHIFT mode: check-in 3 jam sebelum shift (should pass)
- [ ] Test SHIFT mode: check-in 4 jam sebelum shift (should reject)
- [ ] Test SHIFT overnight: window calculation correct (19:00 hari ini - 06:00 besok)
- [ ] Test FLEXIBLE mode: check-in kapan saja (should always pass)
- [ ] Test offline check-in: window validation menggunakan offlineCapturedAt
- [ ] Test edge case: user tanpa jadwal (should allow)

---

*Last Updated: 2026-05-08*  
*Author: System Analysis*
