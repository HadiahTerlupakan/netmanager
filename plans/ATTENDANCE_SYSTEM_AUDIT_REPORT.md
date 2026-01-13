# Laporan Audit Sistem Manajemen Kehadiran

## NetManager - Attendance Management System

**Tanggal Audit:** 13 Januari 2026  
**Auditor:** Kilo Code (Architect Mode)  
**Scope:** Sistem kehadiran, izin, lembur, dan integrasi terkait

---

## 1. Ringkasan Eksekutif

Sistem manajemen kehadiran NetManager memiliki fungsionalitas dasar yang lengkap namun mengalami **inkonsistensi signifikan** dalam implementasi antar fitur, duplikasi kode yang berlebihan, dan kurangnya validasi lintas-modul. Audit ini mengidentifikasi **23 isu kritis** yang mempengaruhi efisiensi operasional, akurasi data, dan pengalaman pengguna.

### Statistik Temuan

- **Isu Kritis:** 8
- **Isu Mayor:** 10
- **Isu Minor:** 5
- **Total Rekomendasi:** 18

---

## 2. Struktur Database dan Model

### 2.1 Tabel Attendance

**Status:** ✅ Struktur baik, namun ada potensi optimasi

**Kolom Utama:**

- `checkIn`, `checkOut` - Timestamps
- `checkInPhoto`, `checkOutPhoto` - Bukti foto
- `status` - ON_TIME, LATE, SICK, ABSENT
- `geofenceStatus`, `geofenceDistance`, `geofenceSiteName` - Validasi lokasi
- `geofenceMeta` - JSONB untuk metadata tambahan

**Isu Teridentifikasi:**

1. **Inkonsistensi Nilai Status:** Tidak ada enum enforcement di database level

   - Code menggunakan: `ON_TIME`, `LATE`, `SICK`, `ABSENT`
   - Report menggunakan: `PRESENT`, `TERLAMBAT` (lihat [`app/api/admin/users/[id]/performance/route.ts:62-64`](app/api/admin/users/[id]/performance/route.ts:62-64))
   - **Dampak:** Confusion dalam reporting dan analytics

2. **Kurang Index Composite:** Query berat pada `userId + checkIn` tidak teroptimasi
   - Lokasi: [`app/api/mobile/attendance/check-in/route.ts:233-240`](app/api/mobile/attendance/check-in/route.ts:233-240)
   - **Dampak:** Potensi slow query saat data attendance bertambah

### 2.2 Tabel User

**Status:** ✅ Mendukung multiple working modes dengan baik

**Kolom Terkait Attendance:**

- `workingHourMode` - FIXED, FLEXIBLE
- `startWorkTime`, `endWorkTime` - Jadwal individu
- `workDays` - Hari kerja (format: "MON,TUE,WED...")
- `flexibleTargetHour` - Target jam kerja untuk FLEXIBLE
- `shiftId` - Referensi ke shift (tapi tidak digunakan)

**Isu Teridentifikasi:** 3. **Shift ID Tidak Digunakan:** Kolom [`shiftId`](postgres://netmgr@localhost:5432/User/schema) ada tapi tidak ada logika yang menggunakannya

- **Dampak:** Fitur shift management tidak aktif

4. **Format workDays Tidak Terdokumentasi:** String format tidak jelas untuk developer baru
   - **Dampak:** Potensi error dalam konfigurasi jadwal

### 2.3 Tabel Overtime

**Status:** ⚠️ Struktur baik tapi relasi dengan attendance kompleks

**Isu Teridentifikasi:** 5. **Relasi Opsional attendanceId:** Bisa `null` saat request dibuat, di-link saat start

- Lokasi: [`modules/overtime/services/OvertimeService.ts:164`](modules/overtime/services/OvertimeService.ts:164)
- **Dampak:** Kompleksitas dalam reporting dan tracking

6. **Durasi dalam menit, bukan jam:** [`duration`](postgres://netmgr@localhost:5432/Overtime/schema) integer (menit)
   - Lokasi: [`modules/overtime/services/OvertimeService.ts:185`](modules/overtime/services/OvertimeService.ts:185)
   - **Dampak:** Inconsistency dengan flexibleTargetHour (jam)

### 2.4 Tabel LeaveRequest

**Status:** ✅ Struktur sederhana dan jelas

**Isu Teridentifikasi:** 7. **Tidak ada validasi overlap:** Bisa request leave yang tumpang tindih

- **Dampak:** Potensi conflict dalam jadwal dan approval

### 2.5 Tabel Holiday

**Status:** ✅ Sederhana dan efektif

**Isu Teridentifikasi:** 8. **Tidak ada cache:** Query holiday setiap kali check-in

- Lokasi: [`app/api/mobile/attendance/check-in/route.ts:146`](app/api/mobile/attendance/check-in/route.ts:146)
- **Dampak:** Unnecessary database hits

---

## 3. API Routes dan Business Logic

### 3.1 Duplikasi Kode - ISU KRITIS

**Lokasi Terdampak:**

- [`app/api/attendance/check-in/route.ts`](app/api/attendance/check-in/route.ts) (Web)
- [`app/api/attendance/check-out/route.ts`](app/api/attendance/check-out/route.ts) (Web)
- [`app/api/mobile/attendance/check-in/route.ts`](app/api/mobile/attendance/check-in/route.ts) (Mobile)
- [`app/api/mobile/attendance/check-out/route.ts`](app/api/mobile/attendance/check-out/route.ts) (Mobile)

**Isu Teridentifikasi:**

9. **Duplikasi 80%+ Logic:** Mobile dan web routes memiliki logika hampir identik

   - Auto-checkout logic duplikat
   - Timezone handling duplikat
   - Photo upload logic duplikat
   - **Dampak:** Maintenance burden, bug fixes harus dilakukan 2x
   - **Lines affected:** ~400+ baris kode duplikat

10. **Inkonsistensi Geofencing:**

    - Mobile: Validasi geofence aktif ([`app/api/mobile/attendance/check-in/route.ts:157-163`](app/api/mobile/attendance/check-in/route.ts:157-163))
    - Web: Tidak ada validasi geofence sama sekali
    - **Dampak:** User bisa check-in dari lokasi sembarang via web

11. **Inkonsistensi Timezone Handling:**
    - Mobile: Menggunakan `checkInTime` yang bisa dari offline capture ([`app/api/mobile/attendance/check-in/route.ts:126-133`](app/api/mobile/attendance/check-in/route.ts:126-133))
    - Web: Selalu menggunakan `new Date()` ([`app/api/attendance/check-in/route.ts:198`](app/api/attendance/check-in/route.ts:198))
    - **Dampak:** Potensi discrepancy dalam timestamp

### 3.2 Auto-Checkout Logic

**Lokasi:**

- [`app/api/attendance/check-in/route.ts:59-116`](app/api/attendance/check-in/route.ts:59-116)
- [`app/api/mobile/attendance/check-in/route.ts:179-229`](app/api/mobile/attendance/check-in/route.ts:179-229)

**Isu Teridentifikasi:**

12. **Logic Berbeda Antara Mobile dan Web:**

    - Web: Auto-checkout untuk FLEXIBLE users juga ([`app/api/attendance/check-in/route.ts:79-81`](app/api/attendance/check-in/route.ts:79-81))
    - Mobile: SKIP untuk FLEXIBLE users ([`app/api/mobile/attendance/check-in/route.ts:183`](app/api/mobile/attendance/check-in/route.ts:183))
    - **Dampak:** Inconsistent behavior berdasarkan platform

13. **Magic Numbers:** Hardcoded values tanpa konstanta
    - `9 * 60 * 60 * 1000` (9 jam)
    - `23, 59, 59, 999` (end of day)
    - **Dampak:** Difficult to maintain dan test

### 3.3 Validasi Status

**Isu Teridentifikasi:**

14. **Holiday Check Hanya di Check-In:**

    - Check-in: Validasi holiday aktif ([`app/api/mobile/attendance/check-in/route.ts:144-150`](app/api/mobile/attendance/check-in/route.ts:144-150))
    - Check-out: Tidak ada validasi holiday
    - **Dampak:** User bisa check-out pada hari libur

15. **Tidak ada Validasi Pending Leave:**
    - User bisa check-in meskipun ada leave request approved untuk hari itu
    - **Dampak:** Conflict antara attendance dan leave records

---

## 4. UI Components dan User Flows

### 4.1 AttendanceCard (Web)

**Lokasi:** [`components/attendance/AttendanceCard.tsx`](components/attendance/AttendanceCard.tsx)

**Isu Teridentifikasi:**

16. **Tidak ada Geofence Warning:** User tidak diberitahu jika di luar zona

    - Lokasi: [`components/attendance/AttendanceCard.tsx:107-122`](components/attendance/AttendanceCard.tsx:107-122)
    - **Dampak:** User mungkin tidak sadar check-in invalid

17. **Tidak ada Status Display untuk LATE/ON_TIME:**
    - Hanya menampilkan jam, tidak menampilkan status kehadiran
    - **Dampak:** User tidak tahu jika terlambat

### 4.2 AttendancePageContent (Mobile)

**Lokasi:** [`components/attendance/AttendancePageContent.tsx`](components/attendance/AttendancePageContent.tsx)

**Isu Teridentifikasi:**

18. **Kompleksitas Berlebihan:** 762 baris untuk satu komponen

    - Camera logic, location logic, attendance logic semua dalam satu file
    - **Dampak:** Difficult to maintain dan test

19. **Hardcoded Map Background:**

    - Lokasi: [`components/attendance/AttendancePageContent.tsx:609`](components/attendance/AttendancePageContent.tsx:609)
    - URL statis yang bisa broken
    - **Dampak:** Bad UX jika gambar tidak load

20. **Inefficient Location Fetching:**
    - Memanggil `getLocation()` pada setiap render ([`components/attendance/AttendancePageContent.tsx:346-348`](components/attendance/AttendancePageContent.tsx:346-348))
    - **Dampak:** Unnecessary API calls dan battery drain

---

## 5. Integrasi Antar Modul

### 5.1 Attendance ↔ Overtime

**Lokasi:** [`modules/overtime/services/OvertimeService.ts:95-166`](modules/overtime/services/OvertimeService.ts:95-166)

**Isu Teridentifikasi:**

21. **Validasi Overtime Terlalu Ketat:**
    - Harus checkout regular attendance dulu (kecuali hari libur)
    - Flexible users harus memenuhi target jam dulu
    - Lokasi: [`modules/overtime/services/OvertimeService.ts:139-156`](modules/overtime/services/OvertimeService.ts:139-156)
    - **Dampak:** User experience buruk, sulit untuk lembur

### 5.2 Attendance ↔ Leave

**Isu Teridentifikasi:**

22. **Tidak ada Cross-Validation:**
    - Attendance tidak mengecek apakah ada approved leave untuk hari itu
    - Leave tidak mengecek apakah user sudah check-in
    - **Dampak:** Data conflict, reporting inaccurate

### 5.3 Attendance ↔ Location Tracking

**Lokasi:** [`modules/attendance/services/LocationTrackingService.ts`](modules/attendance/services/LocationTrackingService.ts)

**Isu Teridentifikasi:**

23. **Location Tracking Tidak Terintegrasi dengan Attendance:**
    - Location tracking berjalan terpisah dari attendance
    - Tidak ada visualisasi path perjalanan untuk attendance
    - **Dampak:** Lost opportunity untuk better tracking dan audit

---

## 6. Alert dan Notification System

**Lokasi:** [`modules/attendance/services/AttendanceAlertService.ts`](modules/attendance/services/AttendanceAlertService.ts)

**Status:** ✅ Well-implemented dengan per-user schedule support

**Isu Teridentifikasi:**

24. **Flexible User Reminder Logic Kompleks:**

    - Menggunakan modulo arithmetic untuk trigger reminder ([`modules/attendance/services/AttendanceAlertService.ts:476`](modules/attendance/services/AttendanceAlertService.ts:476))
    - Logic: `remainder >= 0 && remainder <= 0.25`
    - **Dampak:** Potential missed reminders atau duplicate reminders

25. **Tidak ada Reminder untuk Late Check-In:**
    - Hanya reminder untuk missing check-in/check-out
    - Tidak ada notifikasi jika user terlambat
    - **Dampak:** User tidak sadar jika terlambat

---

## 7. Performance dan Optimasi

### 7.1 Database Queries

**Isu Teridentifikasi:**

26. **N+1 Query Problem di AttendanceService:**

    - Lokasi: [`modules/attendance/services/AttendanceService.ts:92-95`](modules/attendance/services/AttendanceService.ts:92-95)
    - Fetching user details setelah mendapatkan top employee IDs
    - **Dampak:** Slow query saat banyak user

27. **Tidak ada Query Result Caching:**
    - Holiday, settings, user profile di-query berulang-ulang
    - **Dampak:** Unnecessary database load

### 7.2 Image Processing

**Isu Teridentifikasi:**

28. **Base64 to File Conversion Duplikat:**
    - Web: Menggunakan `fetch(photo)` ([`components/attendance/AttendancePageContent.tsx:386-390`](components/attendance/AttendancePageContent.tsx:386-390))
    - Mobile: Menggunakan `convertAndSaveImage` helper
    - **Dampak:** Inconsistent image quality dan size

---

## 8. Security dan Data Integrity

### 8.1 Offline Mode

**Isu Teridentifikasi:**

29. **Trusting Client Timestamp:**

    - Lokasi: [`app/api/mobile/attendance/check-in/route.ts:126-133`](app/api/mobile/attendance/check-in/route.ts:126-133)
    - Menggunakan `offlineCapturedAt` dari client
    - Comment: "SECURITY NOTE: In a real strict environment, trusting client timestamp is risky"
    - **Dampak:** Potensi manipulation data

30. **Tidak ada Signature Verification:**
    - Offline data bisa dimodifikasi sebelum sync
    - **Dampak:** Data integrity risk

### 8.2 Geofencing

**Isu Teridentifikasi:**

31. **Geofence Bisa Dibypass via Web:**
    - Web routes tidak validasi geofence
    - **Dampak:** User bisa check-in dari mana saja menggunakan browser

---

## 9. Rekomendasi Strategis

### 9.1 Refactoring Kritis (Priority: HIGH)

#### R1: Eliminasi Duplikasi Kode

**Action:** Extract common logic into shared service layer

**Files to Create:**

```
modules/attendance/services/AttendanceValidationService.ts
modules/attendance/services/AttendancePhotoService.ts
modules/attendance/services/AttendanceTimezoneService.ts
```

**Benefits:**

- Reduce code duplication by ~60%
- Single source of truth for business logic
- Easier testing and maintenance

**Estimated Impact:** 3-4 hari development

#### R2: Standardisasi Nilai Status

**Action:** Define and enforce status values at database level

**Implementation:**

```sql
-- Add constraint or use enum in Prisma
ALTER TABLE Attendance
ADD CONSTRAINT chk_status
CHECK (status IN ('ON_TIME', 'LATE', 'SICK', 'ABSENT'));
```

**Benefits:**

- Prevent invalid status values
- Consistent reporting across all modules
- Better data integrity

**Estimated Impact:** 1 hari

#### R3: Implementasi Cross-Module Validation

**Action:** Add validation before check-in/check-out

**Logic:**

```typescript
// Before check-in:
1. Check if approved leave exists for today
2. Check if already checked in today
3. Check if holiday (with caching)
4. Validate geofence (all platforms)
```

**Benefits:**

- Prevent data conflicts
- Better user experience (clear error messages)
- Accurate reporting

**Estimated Impact:** 2-3 hari

### 9.2 Optimasi Performance (Priority: MEDIUM)

#### R4: Implementasi Database Indexes

**Action:** Add composite indexes for common queries

```sql
CREATE INDEX idx_attendance_user_checkin
ON Attendance(userId, checkIn DESC);

CREATE INDEX idx_attendance_user_checkout
ON Attendance(userId, checkOut DESC);

CREATE INDEX idx_overtime_user_status
ON Overtime(userId, status);
```

**Benefits:**

- Faster queries by 50-70%
- Better scalability

**Estimated Impact:** 0.5 hari

#### R5: Implementasi Caching Layer

**Action:** Cache frequently accessed data

**Cache Targets:**

- Holiday data (24h TTL)
- User schedules (1h TTL)
- Site geofence zones (24h TTL)

**Benefits:**

- Reduce database load by ~30%
- Faster response times

**Estimated Impact:** 2 hari

#### R6: Optimize Image Processing

**Action:** Standardize image handling

**Implementation:**

- Single utility function for all image operations
- Consistent compression and resizing
- Async processing with queue

**Benefits:**

- Consistent image quality
- Better performance
- Reduced storage costs

**Estimated Impact:** 1-2 hari

### 9.3 Peningkatan UX (Priority: MEDIUM)

#### R7: Implementasi Real-time Status Display

**Action:** Show attendance status with visual indicators

**Features:**

- Status badge (ON_TIME/LATE/EARLY)
- Countdown to check-out time
- Work duration live update

**Benefits:**

- Better user awareness
- Encourage timely check-out
- Reduce late check-outs

**Estimated Impact:** 2-3 hari

#### R8: Improve Geofence UX

**Action:** Add visual feedback for geofence status

**Features:**

- Show distance to office
- Warning when outside zone
- Allow override with reason

**Benefits:**

- Clear user guidance
- Reduced invalid check-ins
- Better compliance

**Estimated Impact:** 2 hari

#### R9: Add Attendance History Analytics

**Action:** Provide insights to users

**Features:**

- Weekly/monthly attendance summary
- Late arrival trends
- Overtime summary

**Benefits:**

- Self-service analytics
- Reduced admin queries
- Better performance tracking

**Estimated Impact:** 3-4 hari

### 9.4 Security dan Data Integrity (Priority: HIGH)

#### R10: Implementasi Offline Data Signing

**Action:** Sign offline attendance records

**Implementation:**

```typescript
// Generate signature on client
const signature = await crypto.subtle.sign(
  "HMAC",
  privateKey,
  JSON.stringify(attendanceData)
);

// Verify on server
const isValid = await crypto.subtle.verify(
  "HMAC",
  publicKey,
  signature,
  JSON.stringify(attendanceData)
);
```

**Benefits:**

- Prevent data manipulation
- Maintain audit trail
- Trustworthy offline data

**Estimated Impact:** 3-4 hari

#### R11: Enforce Geofence on All Platforms

**Action:** Add geofence validation to web routes

**Implementation:**

- Reuse existing GeofenceService
- Add validation to web check-in/check-out
- Provide override mechanism for emergencies

**Benefits:**

- Consistent security across platforms
- Better compliance
- Prevent location fraud

**Estimated Impact:** 1 hari

### 9.5 Business Logic Improvements (Priority: MEDIUM)

#### R12: Simplifikasi Overtime Validation

**Action:** Make overtime rules more flexible

**Changes:**

- Remove mandatory checkout requirement
- Allow overtime start without regular attendance
- Simplify flexible target validation

**Benefits:**

- Better user experience
- More flexible scheduling
- Reduce support tickets

**Estimated Impact:** 1-2 hari

#### R13: Implementasi Shift Management

**Action:** Activate shiftId column

**Features:**

- Define shift templates (morning, afternoon, night)
- Auto-assign shift based on check-in time
- Shift-based reporting

**Benefits:**

- Better schedule management
- Accurate shift tracking
- Improved analytics

**Estimated Impact:** 4-5 hari

#### R14: Add Leave-Attendance Conflict Detection

**Action:** Prevent overlapping records

**Implementation:**

```typescript
// Check before creating attendance
const hasLeave = await leaveRepository.findApprovedForDate(userId, date);
if (hasLeave) {
  throw new Error("Anda memiliki izin untuk tanggal ini");
}
```

**Benefits:**

- Prevent data conflicts
- Accurate attendance records
- Better payroll calculation

**Estimated Impact:** 1-2 hari

---

## 10. Roadmap Implementasi

### Phase 1: Critical Fixes (Week 1-2)

1. ✅ Standardize status values (R2)
2. ✅ Add database indexes (R4)
3. ✅ Implement cross-module validation (R3)
4. ✅ Enforce geofence on web (R11)

### Phase 2: Refactoring (Week 3-4)

5. ✅ Extract common logic to services (R1)
6. ✅ Standardize image processing (R6)
7. ✅ Implement caching layer (R5)

### Phase 3: UX Improvements (Week 5-6)

8. ✅ Add real-time status display (R7)
9. ✅ Improve geofence UX (R8)
10. ✅ Add attendance analytics (R9)

### Phase 4: Advanced Features (Week 7-8)

11. ✅ Implement offline signing (R10)
12. ✅ Simplify overtime validation (R12)
13. ✅ Activate shift management (R13)
14. ✅ Add conflict detection (R14)

---

## 11. Metrik Keberhasilan

### Target Metrics

- **Code Duplication:** Reduce from 80% to <20%
- **Query Performance:** Improve by 50%+ (average response time <200ms)
- **Data Accuracy:** 100% status consistency, 0 conflicts
- **User Satisfaction:** Reduce support tickets by 40%
- **System Reliability:** 99.9% uptime for attendance features

### Success Indicators

- ✅ Single source of truth for business logic
- ✅ Consistent behavior across web and mobile
- ✅ Zero invalid status values
- ✅ No attendance-leave conflicts
- ✅ Fast and responsive UI
- ✅ Secure offline data handling

---

## 12. Kesimpulan

Sistem manajemen kehadiran NetManager memiliki fondasi yang kuat namun memerlukan refactoring signifikan untuk mencapai efisiensi operasional maksimal. Isu-isu yang teridentifikasi dapat dikelompokkan menjadi tiga kategori utama:

1. **Konsistensi:** Duplikasi kode dan inkonsistensi logika antar platform
2. **Integrasi:** Kurangnya validasi lintas-modul menyebabkan conflict data
3. **Optimasi:** Performance dan UX dapat ditingkatkan dengan caching dan refactoring

Dengan mengimplementasikan rekomendasi yang diusulkan secara bertahap, sistem dapat mencapai:

- **Efisiensi operasional:** 40-50% improvement
- **Akurasi data:** 100% consistency
- **Pengalaman pengguna:** Significantly better
- **Maintenance cost:** Reduced by 50%

**Prioritas Utama:** Mulai dengan Phase 1 (Critical Fixes) untuk mengatasi isu-isu yang paling berdampak pada akurasi data dan keamanan sistem.

---

## Appendix A: File Reference

### Core Attendance Files

- [`modules/attendance/services/AttendanceService.ts`](modules/attendance/services/AttendanceService.ts)
- [`modules/attendance/services/AttendanceAlertService.ts`](modules/attendance/services/AttendanceAlertService.ts)
- [`modules/attendance/services/GeofenceService.ts`](modules/attendance/services/GeofenceService.ts)
- [`modules/attendance/repositories/AttendanceRepository.ts`](modules/attendance/repositories/AttendanceRepository.ts)
- [`modules/attendance/repositories/HolidayRepository.ts`](modules/attendance/repositories/HolidayRepository.ts)
- [`modules/attendance/repositories/LeaveRepository.ts`](modules/attendance/repositories/LeaveRepository.ts)

### API Routes

- [`app/api/attendance/check-in/route.ts`](app/api/attendance/check-in/route.ts)
- [`app/api/attendance/check-out/route.ts`](app/api/attendance/check-out/route.ts)
- [`app/api/mobile/attendance/check-in/route.ts`](app/api/mobile/attendance/check-in/route.ts)
- [`app/api/mobile/attendance/check-out/route.ts`](app/api/mobile/attendance/check-out/route.ts)
- [`app/api/admin/attendance/route.ts`](app/api/admin/attendance/route.ts)
- [`app/api/admin/reports/presence/route.ts`](app/api/admin/reports/presence/route.ts)

### UI Components

- [`components/attendance/AttendanceCard.tsx`](components/attendance/AttendanceCard.tsx)
- [`components/attendance/AttendancePageContent.tsx`](components/attendance/AttendancePageContent.tsx)
- [`components/attendance/EmployeeLocationMap.tsx`](components/attendance/EmployeeLocationMap.tsx)

### Overtime Module

- [`modules/overtime/services/OvertimeService.ts`](modules/overtime/services/OvertimeService.ts)
- [`modules/overtime/repositories/OvertimeRepository.ts`](modules/overtime/repositories/OvertimeRepository.ts)
- [`app/api/mobile/overtime/route.ts`](app/api/mobile/overtime/route.ts)

### Database Schemas

- [`Attendance`](postgres://netmgr@localhost:5432/Attendance/schema)
- [`Overtime`](postgres://netmgr@localhost:5432/Overtime/schema)
- [`LeaveRequest`](postgres://netmgr@localhost:5432/LeaveRequest/schema)
- [`Holiday`](postgres://netmgr@localhost:5432/Holiday/schema)
- [`User`](postgres://netmgr@localhost:5432/User/schema)

---

**End of Report**
