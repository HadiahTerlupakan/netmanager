# Review Flow Bisnis Absensi: Libur, Hari Kerja, dan Izin

**Tanggal Review:** 2026-05-10  
**Reviewer:** AI Assistant  
**Scope:** Attendance Module - Holiday, Working Days, Leave Management

---

## Executive Summary

Sistem absensi memiliki 3 komponen utama yang saling terkait:
1. **Holiday Management** - Pengelolaan hari libur nasional/regional
2. **Working Days** - Penentuan jadwal kerja per karyawan
3. **Leave Management** - Pengelolaan cuti/izin karyawan

Review ini mengidentifikasi **flow bisnis yang sudah baik** dan **beberapa area yang perlu perbaikan**.

---

## 1. HOLIDAY MANAGEMENT (Hari Libur)

### 1.1 Arsitektur & Implementasi

**Repository:** `HolidayRepository.ts`
- ✅ Menggunakan Redis cache dengan TTL 24 jam
- ✅ Cache invalidation dengan versioning system
- ✅ Tenant isolation (multi-tenancy support)
- ✅ Method `isHoliday()` untuk check apakah tanggal adalah libur
- ✅ Method `getHolidaysByYear()` untuk list libur per tahun

**API Endpoints:**
- `GET /api/admin/holidays` - List holidays by year
- `POST /api/admin/holidays` - Create holiday
- `PUT /api/admin/holidays/[id]` - Update holiday
- `DELETE /api/admin/holidays/[id]` - Delete holiday

**Service:** `AdminHolidayRouteService.ts`

### 1.2 Flow Bisnis Holiday

```
1. Admin membuat holiday baru
   ↓
2. Holiday disimpan ke database dengan tenantId
   ↓
3. Cache invalidation (increment version)
   ↓
4. Activity log dicatat
   ↓
5. Saat check-in, sistem cek apakah tanggal adalah holiday
   ↓
6. Jika holiday → block check-in dengan pesan error
```

### 1.3 Integrasi dengan Attendance

**File:** `AttendanceValidationService.ts` (line 69-77, 185-191)

```typescript
// Check holiday saat validasi check-in
const holidayInfo = await this.holidayRepo.isHoliday(startOfDay, tenantId);

if (dayMetadata.isHoliday) {
  return {
    isValid: false,
    reason: `Hari ini adalah hari libur: ${dayMetadata.holidayName}`,
    type: "HOLIDAY",
  };
}
```

### 1.4 Integrasi dengan Working Days Calculation

**File:** `calculateWorkingDays.ts` (line 32-39)

```typescript
// Exclude holidays dari perhitungan hari kerja
if (allowedDays.includes(dayName)) {
  const { isHoliday } = await holidayRepository.isHoliday(curDate, tenantId);
  if (!isHoliday) {
    days++;
  }
}
```

### 1.5 ✅ Kelebihan Holiday Management

1. **Cache Strategy Solid** - Redis cache dengan versioning mencegah stale data
2. **Tenant Isolation** - Setiap tenant bisa punya holiday berbeda
3. **Integration Point Clear** - Holiday check terintegrasi di validation layer
4. **Performance Optimized** - Cache TTL 24 jam cocok untuk data yang jarang berubah

### 1.6 ⚠️ Potensi Masalah Holiday Management

#### **MASALAH 1: Tidak Ada Validasi Duplikasi Tanggal**

**Lokasi:** `app/api/admin/holidays/route.ts` (line 72-78)

```typescript
const holiday = await holidayService.createHoliday(
  { date, description, isNational },
  tenantId,
);
if (!holiday) {
  return ApiErrors.conflict("Hari libur untuk tanggal ini sudah ada");
}
```

**Issue:** Service mengembalikan `null` jika duplikasi, tapi tidak ada unique constraint di database level.

**Rekomendasi:**
- Tambahkan unique constraint di Prisma schema: `@@unique([date, tenantId])`
- Atau handle duplicate di service layer dengan explicit check

#### **MASALAH 2: Tidak Ada Bulk Import Holiday**

**Issue:** Admin harus input holiday satu per satu. Untuk 10-15 hari libur nasional per tahun, ini tidak efisien.

**Rekomendasi:**
- Tambahkan endpoint `POST /api/admin/holidays/bulk` untuk import CSV/JSON
- Atau seed script untuk holiday nasional Indonesia (sudah ada di `prisma/seed-holidays.ts` tapi tidak terintegrasi dengan UI)

#### **MASALAH 3: Tidak Ada Notifikasi ke Karyawan**

**Issue:** Saat admin menambah/ubah holiday, karyawan tidak mendapat notifikasi.

**Rekomendasi:**
- Broadcast notification saat holiday baru dibuat
- Tampilkan upcoming holidays di mobile app dashboard

---

## 2. WORKING DAYS (Hari Kerja)

### 2.1 Arsitektur & Implementasi

**Utility:** `workingDayUtils.ts`

**Format workDays yang Didukung:**
- Short English: `"Mon,Tue,Wed,Thu,Fri"`
- Full English: `"Monday,Tuesday,Wednesday,Thursday,Friday"`
- Indonesian: `"Senin,Selasa,Rabu,Kamis,Jumat"`
- Numeric: `"1,2,3,4,5"` (0=Sunday, 6=Saturday)

**Working Hour Modes:**
1. **FIXED** - Jam kerja tetap (startWorkTime, endWorkTime)
2. **SHIFT** - Jam kerja berdasarkan shift
3. **FLEXIBLE** - Tidak ada batasan jam kerja

### 2.2 Flow Bisnis Working Days

```
1. User memiliki workDays setting (contoh: "Mon,Tue,Wed,Thu,Fri")
   ↓
2. User memiliki workingHourMode (FIXED/SHIFT/FLEXIBLE)
   ↓
3. Saat check-in, sistem parse workDays ke array angka
   ↓
4. Sistem cek apakah hari ini termasuk working day
   ↓
5. Jika FLEXIBLE → selalu allowed (no off-day)
   ↓
6. Jika FIXED/SHIFT → cek apakah dayOfWeek ada di workDays
   ↓
7. Jika off-day → block check-in
```

### 2.3 Integrasi dengan Attendance Validation

**File:** `AttendanceValidationService.ts` (line 122-131)

```typescript
let isOffDay = isOffDayForUser(
  dayOfWeek,
  user?.workDays ?? null,
  user?.workingHourMode ?? null,
);

// Override dengan Tukar Libur
if (tukarLiburFlags.isTukarLiburWorkDay) isOffDay = false;
if (tukarLiburFlags.isTukarLiburLeaveDay) isOffDay = true;
```

### 2.4 ✅ Kelebihan Working Days

1. **Multi-Format Support** - Mendukung berbagai format input (English, Indonesian, Numeric)
2. **Flexible Mode** - FLEXIBLE mode cocok untuk freelancer/contractor
3. **Tukar Libur Integration** - Working day bisa di-override dengan Tukar Libur
4. **Safeguard** - Jika workDays kosong, tidak block user (line 63-64 `workingDayUtils.ts`)

### 2.5 ⚠️ Potensi Masalah Working Days

#### **MASALAH 4: Tidak Ada Validasi Format workDays**

**Lokasi:** `workingDayUtils.ts` (line 31-42)

```typescript
export function parseWorkDaysToNumbers(workDays: string | null | undefined): number[] {
    if (!workDays) return []
    return workDays
        .split(',')
        .map(d => {
            const trimmed = d.trim()
            const parsed = parseInt(trimmed)
            if (!isNaN(parsed)) return parsed
            return dayNameToNumber[trimmed]
        })
        .filter((d): d is number => d !== undefined)
}
```

**Issue:** Jika admin input format salah (typo, mixed format), parsing akan gagal silent dan return empty array.

**Contoh Kasus:**
- Input: `"Mon,Tue,Rabu,Thu,Fri"` (mixed English-Indonesian)
- Result: `[1, 2, 3, 4, 5]` ✅ (works by luck)
- Input: `"Mon,Tues,Wed"` (typo: Tues instead of Tue)
- Result: `[1, 3]` ❌ (Tuesday hilang tanpa warning)

**Rekomendasi:**
- Tambahkan validation di user creation/update API
- Normalize format ke numeric saat save ke database
- Atau gunakan enum di Prisma schema

#### **MASALAH 5: Tidak Ada UI untuk Setting workDays**

**Issue:** Tidak ditemukan UI di admin portal untuk set workDays per user. Kemungkinan harus manual edit database atau via API.

**Rekomendasi:**
- Tambahkan form di user profile/settings untuk pilih working days
- Checkbox UI: ☑ Mon ☑ Tue ☑ Wed ☑ Thu ☑ Fri ☐ Sat ☐ Sun

#### **MASALAH 6: Tidak Ada Bulk Update Working Days**

**Issue:** Jika perusahaan ubah kebijakan (misal: Sabtu jadi libur), admin harus update satu per satu.

**Rekomendasi:**
- Tambahkan endpoint untuk bulk update workDays by department/site
- Atau gunakan "default workDays" di tenant level yang bisa di-override per user

---

## 3. LEAVE MANAGEMENT (Cuti/Izin)

### 3.1 Arsitektur & Implementasi

**Repository:** `LeaveRepository.ts` (facade pattern)
- `LeaveLookupRepository` - Query operations
- `LeaveMobileRepository` - Mobile-specific queries
- `LeaveRequestRepository` - CRUD operations

**Leave Types:**
- `CUTI` - Cuti tahunan
- `SAKIT` - Sakit (dengan/tanpa surat dokter)
- `IZIN` - Izin (keperluan pribadi)
- `LAINNYA` - Lainnya
- `TUKAR_LIBUR` - Tukar hari libur dengan hari kerja

**Leave Status:**
- `PENDING` - Menunggu approval
- `APPROVED` - Disetujui
- `REJECTED` - Ditolak

### 3.2 Flow Bisnis Leave Request (Mobile)

```
1. Karyawan submit leave request via mobile app
   ↓
2. System validate:
   - Apakah tanggal valid?
   - Apakah ada overlap dengan leave lain?
   - Apakah sisa cuti mencukupi? (untuk type CUTI)
   ↓
3. Leave request disimpan dengan status PENDING
   ↓
4. Notification dikirim ke approver (admin/manager)
   ↓
5. Admin approve/reject via admin portal
   ↓
6. Jika APPROVED:
   - Decrement leave balance (untuk CUTI)
   - Sync ke attendance (create auto-alpha records)
   - Notification ke karyawan
   ↓
7. Jika REJECTED:
   - Notification ke karyawan dengan rejection reason
```

**File:** `app/api/mobile/leaves/route.ts`

### 3.3 Flow Bisnis Leave Approval (Admin)

```
1. Admin buka list leave requests (filter by status)
   ↓
2. Admin review leave request details
   ↓
3. Admin approve/reject dengan optional notes
   ↓
4. System execute:
   - Update leave status
   - Increment/refund leave balance
   - Sync/revert attendance records
   - Send notification
   - Log activity
```

**File:** `app/api/admin/leaves/[id]/route.ts`

### 3.4 Leave Balance Management

**Service:** `LeaveBalanceUsageService.ts`

**Flow:**
```
1. Saat leave APPROVED (type CUTI):
   - Calculate working days (exclude weekends & holidays)
   - Decrement dari leave balance
   ↓
2. Saat leave REJECTED atau DELETED:
   - Refund leave balance (jika sebelumnya APPROVED)
```

**File:** `leave-lifecycle.helpers.ts` (line 137-168)

### 3.5 Leave Attendance Sync

**Service:** `LeaveAttendanceSyncService.ts`

**Flow:**
```
1. Saat leave APPROVED:
   - Create attendance records untuk setiap hari leave
   - Status: ALPHA (dengan flag isLeave)
   - Ini mencegah karyawan kena absent/alpha
   ↓
2. Saat leave REJECTED/DELETED:
   - Delete attendance records yang di-create
   - Atau update flag isLeave = false
```

**File:** `leave-lifecycle.helpers.ts` (line 121-133, 157-168)

### 3.6 Tukar Libur (Special Case)

**Validation Service:** `LeaveTukarLiburValidationService.ts`

**Flow:**
```
1. Karyawan pilih:
   - Source date (hari kerja yang mau ditukar)
   - Replacement date (hari libur yang mau dijadikan kerja)
   ↓
2. System validate:
   - Source date harus working day
   - Replacement date harus off-day atau holiday
   - Tidak ada overlap dengan leave lain
   ↓
3. Jika APPROVED:
   - Source date jadi off-day (karyawan libur)
   - Replacement date jadi working day (karyawan kerja)
```

**Integrasi:** `AttendanceValidationService.ts` (line 84-104, 128-130)

### 3.7 ✅ Kelebihan Leave Management

1. **Comprehensive Lifecycle** - Create, approve, reject, delete dengan proper state management
2. **Balance Tracking** - Leave balance di-track dengan benar (increment/refund)
3. **Attendance Sync** - Leave otomatis sync ke attendance records (prevent alpha)
4. **Tukar Libur Support** - Fitur unik untuk swap working day dengan off-day
5. **Notification System** - Approver dan requester dapat notifikasi
6. **Activity Logging** - Semua action di-log untuk audit trail
7. **Multi-Tenant** - Proper tenant isolation

### 3.8 ⚠️ Potensi Masalah Leave Management

#### **MASALAH 7: Tidak Ada Auto-Approval Rules**

**Lokasi:** `app/api/admin/leaves/route.ts` (line 77-85)

**Issue:** Semua leave request harus manual approval oleh admin. Tidak ada auto-approval untuk kasus tertentu.

**Use Case yang Bisa Auto-Approve:**
- Izin 1 hari (type IZIN)
- Sakit dengan surat dokter
- Leave request > 7 hari sebelum tanggal mulai

**Rekomendasi:**
- Tambahkan auto-approval rules di tenant settings
- Contoh: `autoApproveIzinUnder1Day: true`

#### **MASALAH 8: Tidak Ada Leave Quota Management**

**Issue:** Tidak ditemukan sistem untuk set leave quota per karyawan per tahun.

**Pertanyaan:**
- Berapa jatah cuti per karyawan per tahun? (default: 12 hari?)
- Apakah ada carry-over cuti ke tahun berikutnya?
- Apakah ada leave quota berbeda per level/department?

**Rekomendasi:**
- Tambahkan `LeaveQuota` table dengan fields:
  - userId, year, type, total, used, remaining
- Auto-reset quota setiap tahun baru
- UI untuk admin set quota per user

#### **MASALAH 9: Tidak Ada Leave Calendar View**

**Issue:** Tidak ada UI untuk lihat leave calendar (siapa saja yang cuti di bulan ini).

**Rekomendasi:**
- Tambahkan calendar view di admin portal
- Tampilkan semua approved leaves dalam bentuk calendar
- Berguna untuk planning dan avoid konflik (misal: terlalu banyak orang cuti di tanggal sama)

#### **MASALAH 10: Overlap Detection Tidak Jelas**

**Issue:** Tidak ditemukan explicit validation untuk detect overlap leave requests.

**Contoh Kasus:**
- User submit leave 10-15 Mei
- User submit leave lagi 12-17 Mei (overlap!)
- Apakah sistem block ini?

**Rekomendasi:**
- Tambahkan validation di `LeaveService.create()`:
  ```typescript
  const existingLeave = await leaveRepo.findOverlapping(userId, startDate, endDate);
  if (existingLeave) {
    return { success: false, error: "Anda sudah punya leave request di tanggal ini" };
  }
  ```

#### **MASALAH 11: Tidak Ada Attachment Validation**

**Lokasi:** `app/api/admin/leaves/route.ts` (line 38)

```typescript
attachmentUrl: z.url().optional().nullable(),
```

**Issue:** 
- Untuk type SAKIT, seharusnya wajib upload surat dokter (jika > 2 hari)
- Tidak ada validation file type (harus image/pdf)
- Tidak ada validation file size

**Rekomendasi:**
- Conditional validation: `if (type === 'SAKIT' && days > 2) { require attachment }`
- Validate file type di upload endpoint
- Set max file size (misal: 5MB)

#### **MASALAH 12: Tidak Ada Leave History Export**

**Issue:** Tidak ada endpoint untuk export leave history ke Excel/CSV.

**Rekomendasi:**
- Tambahkan `GET /api/admin/leaves/export?year=2026&format=xlsx`
- Berguna untuk HR reporting dan audit

---

## 4. INTEGRASI ANTAR KOMPONEN

### 4.1 Check-In Validation Flow (Lengkap)

```
User tap "Check-In" di mobile app
  ↓
1. Validate Eligibility (AttendanceValidationService.validateCheckInEligibility)
   ├─ Check Active Leave → BLOCK jika ada
   ├─ Check Holiday → BLOCK jika holiday
   └─ Check Off-Day → BLOCK jika off-day (kecuali Tukar Libur)
  ↓
2. Validate Time Window (AttendanceValidationService.validateCheckInTimeWindow)
   ├─ FLEXIBLE mode → ALLOW anytime
   ├─ FIXED/SHIFT mode → Check window (3 jam sebelum - jam akhir kerja)
   └─ BLOCK jika di luar window
  ↓
3. Validate Photo (AttendancePhotoValidationService)
   ├─ Check file size
   ├─ Check image format
   └─ Validate dengan sharp library
  ↓
4. Create Attendance Session
   ├─ Save check-in time
   ├─ Save location (lat/long)
   └─ Save photo URL
  ↓
5. Return Success
```

### 4.2 Working Days Calculation (untuk Leave)

**File:** `calculateWorkingDays.ts`

```
Input: startDate, endDate, workDays, tenantId
  ↓
1. Loop setiap hari dari startDate ke endDate
  ↓
2. Untuk setiap hari:
   ├─ Check apakah termasuk workDays (Mon-Fri)
   ├─ Check apakah holiday (via HolidayRepository)
   └─ Jika working day DAN bukan holiday → count++
  ↓
Output: total working days
```

**Digunakan untuk:**
- Calculate leave balance usage
- Calculate salary deduction (jika unpaid leave)

### 4.3 Auto-Alpha Creation (untuk Approved Leave)

**Service:** `LeaveAttendanceSyncService.syncLeaveToAttendance()`

```
Input: Approved Leave (startDate, endDate, userId)
  ↓
1. Loop setiap hari dari startDate ke endDate
  ↓
2. Untuk setiap hari:
   ├─ Check apakah sudah ada attendance record
   ├─ Jika belum ada → Create attendance dengan status ALPHA
   └─ Set flag isLeave = true
  ↓
3. Ini mencegah karyawan kena absent/alpha di report
```

---

## 5. REKOMENDASI PRIORITAS

### 🔴 HIGH PRIORITY (Harus Segera Diperbaiki)

1. **[MASALAH 10] Tambahkan Overlap Detection untuk Leave Request**
   - Impact: Prevent double-booking leave
   - Effort: Low (1-2 jam)

2. **[MASALAH 8] Implementasi Leave Quota Management**
   - Impact: Core feature yang missing
   - Effort: Medium (1-2 hari)

3. **[MASALAH 4] Validasi Format workDays**
   - Impact: Prevent silent failure
   - Effort: Low (2-3 jam)

### 🟡 MEDIUM PRIORITY (Perbaikan UX)

4. **[MASALAH 2] Bulk Import Holiday**
   - Impact: Admin efficiency
   - Effort: Low (3-4 jam)

5. **[MASALAH 5] UI untuk Setting workDays**
   - Impact: Admin UX
   - Effort: Medium (1 hari)

6. **[MASALAH 9] Leave Calendar View**
   - Impact: Planning & visibility
   - Effort: Medium (1-2 hari)

### 🟢 LOW PRIORITY (Nice to Have)

7. **[MASALAH 7] Auto-Approval Rules**
   - Impact: Reduce admin workload
   - Effort: Medium (1 hari)

8. **[MASALAH 3] Holiday Notification**
   - Impact: User awareness
   - Effort: Low (2-3 jam)

9. **[MASALAH 12] Leave History Export**
   - Impact: HR reporting
   - Effort: Low (3-4 jam)

---

## 6. KESIMPULAN

### ✅ Yang Sudah Baik

1. **Arsitektur Solid** - Clean separation: Repository → Service → API
2. **Multi-Tenancy** - Proper tenant isolation di semua layer
3. **Cache Strategy** - Holiday cache dengan versioning
4. **Attendance Sync** - Leave otomatis sync ke attendance
5. **Tukar Libur** - Fitur unik dan well-implemented
6. **Activity Logging** - Audit trail lengkap

### ⚠️ Yang Perlu Diperbaiki

1. **Leave Quota System** - Belum ada management quota cuti
2. **Overlap Detection** - Belum ada validation overlap leave
3. **Working Days Validation** - Format parsing bisa silent fail
4. **Bulk Operations** - Belum ada bulk import/update
5. **Calendar View** - Belum ada visual calendar untuk leave
6. **Auto-Approval** - Semua manual, belum ada rules

### 📊 Skor Keseluruhan

| Aspek | Skor | Keterangan |
|-------|------|------------|
| **Holiday Management** | 8/10 | Solid, perlu bulk import |
| **Working Days** | 7/10 | Perlu validation & UI |
| **Leave Management** | 7/10 | Core flow bagus, perlu quota system |
| **Integration** | 9/10 | Integrasi antar komponen sangat baik |
| **Overall** | **7.75/10** | **Good, dengan beberapa improvement area** |

---

## 7. NEXT STEPS

1. **Review dengan Tim**
   - Diskusikan prioritas perbaikan
   - Validasi use case yang missing
   - Tentukan timeline implementasi

2. **Create Tasks**
   - Buat task untuk setiap masalah yang akan diperbaiki
   - Assign ke developer
   - Set deadline

3. **Testing**
   - Tambahkan unit test untuk edge cases
   - Integration test untuk flow lengkap
   - E2E test untuk user journey

4. **Documentation**
   - Update API documentation
   - Buat user guide untuk admin
   - Buat FAQ untuk karyawan

---

**End of Review**
