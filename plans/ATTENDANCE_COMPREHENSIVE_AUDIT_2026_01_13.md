# Laporan Audit Teknis End-to-End Komprehensif

## Fitur Kehadiran (Attendance) - NetManager

**Tanggal Audit:** 13 Januari 2026 (Sesi Siang)  
**Auditor:** Antigravity AI  
**Metode:** Analisis statis kode, pemetaan arsitektur, dan tracing alur proses bisnis  
**Status:** ✅ AUDIT SELESAI

---

## 1. Pemetaan Struktur Fitur Kehadiran

### 1.1 Struktur Direktori

```
netmanager/
├── modules/attendance/
│   ├── services/
│   │   ├── AttendanceService.ts (280 lines) - Core check-in logic
│   │   ├── AttendanceAlertService.ts (538 lines) - Notification & reminders
│   │   ├── AttendancePhotoService.ts (2KB) - Photo processing
│   │   ├── AttendanceTimezoneService.ts (3.5KB) - Timezone handling
│   │   ├── AttendanceValidationService.ts (72 lines) - Leave/holiday validation
│   │   ├── AutoCheckoutService.ts (86 lines) - Auto-checkout cron
│   │   ├── GeofenceService.ts (135 lines) - Location validation
│   │   └── LocationTrackingService.ts (353 lines) - Live tracking
│   └── repositories/
│       ├── AttendanceRepository.ts (346 lines) - Data access
│       ├── HolidayRepository.ts (3KB) - Holiday management
│       └── LeaveRepository.ts (2.8KB) - Leave management
├── app/api/attendance/
│   ├── check-in/route.ts - Web check-in API
│   ├── check-out/route.ts - Web check-out API
│   ├── config/route.ts - Site configuration
│   ├── history/route.ts - User history
│   └── analytics/route.ts - User analytics
├── app/api/mobile/attendance/
│   ├── check-in/route.ts - Mobile check-in API
│   ├── check-out/route.ts - Mobile check-out API
│   └── history/route.ts - Mobile history API
├── app/api/admin/attendance/
│   ├── route.ts - Admin list & export
│   └── [id]/route.ts - Admin CRUD operations
├── app/admin/attendance/
│   ├── page.tsx - Admin page
│   └── AttendanceClient.tsx (579 lines) - Admin UI component
└── components/attendance/
    ├── AttendancePageContent.tsx
    ├── AttendanceCard.tsx
    ├── AttendanceStatusIndicator.tsx
    └── AttendanceAnalytics.tsx

mobile-netmanager/
└── app/(app)/absensi.tsx (920 lines) - Mobile attendance screen
```

### 1.2 Skema Database

```prisma
model Attendance {
  id                       String           @id
  userId                   String
  checkIn                  DateTime         @default(now())
  checkOut                 DateTime?
  checkInPhoto             String?
  checkOutPhoto            String?
  status                   AttendanceStatus @default(ON_TIME)
  notes                    String?
  location                 String?
  checkOutLocation         String?
  geofenceStatus           String?
  geofenceDistance         Float?
  geofenceSiteName         String?
  checkOutGeofenceStatus   String?
  checkOutGeofenceDistance Float?
  geofenceMeta             Json?
  user                     User             @relation(...)
  overtime                 Overtime[]

  @@index([checkIn])
  @@index([status])
  @@index([userId])
  @@index([userId, checkIn])
}

enum AttendanceStatus {
  ON_TIME
  LATE
  ABSENT
  SICK
  PERMIT
  DAY_OFF
}
```

### 1.3 Alur Proses Bisnis

#### Sub-Menu 1: Check-In (Masuk)

```
Mobile/Web → API Route → AttendanceService.checkIn()
    ├── 1. Timezone Context (AttendanceTimezoneService)
    ├── 2. Cross-Module Validation (AttendanceValidationService)
    │       └── Check: Leave, Holiday
    ├── 3. User Schedule Fetch (with caching)
    ├── 4. Auto-Checkout Stale Sessions
    ├── 5. Duplicate Entry Check
    ├── 6. Geofence Validation (GeofenceService)
    ├── 7. Status Calculation (LATE vs ON_TIME)
    └── 8. Create Attendance Record
```

#### Sub-Menu 2: Check-Out (Pulang)

```
Mobile/Web → API Route → Direct Prisma Update ⚠️
    ├── 1. Find Active Attendance (last 24h)
    ├── 2. Photo Processing (AttendancePhotoService)
    ├── 3. Geofence Validation (Mobile only)
    └── 4. Update Attendance Record
```

#### Sub-Menu 3: Admin Management

```
Admin UI → /api/admin/attendance
    ├── GET: List with filters, pagination, export
    ├── PATCH: Update check-in/out times, status
    └── DELETE: Remove attendance record
```

#### Sub-Menu 4: Auto-Checkout (Cron)

```
Scheduled Job → AutoCheckoutService.runAutoCheckout()
    ├── Find open attendances (checkOut is null)
    ├── Exclude FLEXIBLE users
    ├── Set checkOut to 23:59:59 of check-in date
    └── Set status to ABSENT
```

#### Sub-Menu 5: Alert & Reminders

```
Cron (15 min) → AttendanceAlertService.runScheduledAttendanceCheck()
    ├── processCheckInReminders()
    ├── processCheckOutReminders()
    ├── processLateCheckOutReminders()
    └── processFlexibleReminders()
```

---

## 2. Temuan Audit - Klasifikasi berdasarkan Prioritas

### 2.1 🔴 KRITIS (Memerlukan Perbaikan Segera)

#### K1. Inkonsistensi Logic Auto-Checkout

**Lokasi:**

- `modules/attendance/services/AutoCheckoutService.ts` (line 73)
- `modules/attendance/services/AttendanceService.ts` (line 179-183)

**Deskripsi:**
Terdapat dua implementasi auto-checkout yang berbeda:

- `AutoCheckoutService.runAutoCheckout()` set status ke `'ABSENT'`
- `AttendanceService.processAutoCheckout()` TIDAK mengubah status

**Dampak:** Data status attendance tidak konsisten. User yang terkena auto-checkout bisa memiliki status berbeda tergantung trigger mana yang jalan.

**Solusi Teknis:**

```typescript
// Di AttendanceService.processAutoCheckout(), tambahkan:
await prisma.attendance.update({
  where: { id: session.id },
  data: {
    checkOut: autoCheckOut,
    notes: newNotes,
    status: "ABSENT", // <-- TAMBAHKAN INI
  },
});
```

---

#### K2. Status Enum Tidak Valid di Admin UI

**Lokasi:** `app/admin/attendance/AttendanceClient.tsx` (line 550-556)

**Deskripsi:**
UI menampilkan opsi "PRESENT" yang tidak ada di enum `AttendanceStatus`.

```tsx
<option value="PRESENT">Hadir (PRESENT)</option> // ❌ INVALID
```

**Dampak:** Database rejection jika admin memilih "PRESENT". Prisma akan throw error karena enum tidak valid.

**Solusi Teknis:**

```tsx
// Hapus opsi PRESENT dan sesuaikan dengan enum valid
<option value="ON_TIME">Tepat Waktu (ON_TIME)</option>
<option value="LATE">Terlambat (LATE)</option>
<option value="SICK">Sakit (SICK)</option>
<option value="PERMIT">Izin (PERMIT)</option>
<option value="ABSENT">Alpha (ABSENT)</option>
<option value="DAY_OFF">Libur (DAY_OFF)</option>
```

---

#### K3. Summary Card Menggunakan Status Tidak Valid

**Lokasi:** `app/admin/attendance/AttendanceClient.tsx` (line 389)

**Deskripsi:**

```tsx
<div className="text-2xl font-bold">
  {summary["ON_TIME"] || summary["PRESENT"] || 0}
</div>
```

Mencari `summary['PRESENT']` yang tidak akan pernah ada di database.

**Solusi Teknis:**

```tsx
<div className="text-2xl font-bold">{summary["ON_TIME"] || 0}</div>
```

---

### 2.2 🟠 TINGGI (Prioritas Perbaikan Minggu Ini)

#### T1. Console.log di Production Code

**Lokasi:** Multiple files

| File                              | Lines                             |
| --------------------------------- | --------------------------------- |
| `/api/attendance/config/route.ts` | 27-34                             |
| `/api/admin/attendance/route.ts`  | 186                               |
| `mobile/absensi.tsx`              | 102, 108-112, 123, 130, 134, 153+ |

**Dampak:**

- Information leak (sensitive data exposure)
- Performance degradation
- Log pollution

**Solusi Teknis:**

```typescript
// Gunakan logger yang sudah ada
import { logger } from '@/lib/logger'

// Di config/route.ts, hapus:
console.log('Attendance Config Fetch:', {...})

// Di mobile, wrap dengan __DEV__ check:
if (__DEV__) console.log('[Debug]', ...)
```

---

#### T2. RBAC Bypass - Status Validation Missing

**Lokasi:** `app/api/admin/attendance/[id]/route.ts` (line 160)

**Deskripsi:**
Status bisa diset ke nilai apapun tanpa validasi terhadap enum valid.

```typescript
updateData.status = status; // ❌ No validation
```

**Dampak:** Admin bisa set status ke nilai invalid yang menyebabkan data corruption.

**Solusi Teknis:**

```typescript
const validStatuses = [
  "ON_TIME",
  "LATE",
  "ABSENT",
  "SICK",
  "PERMIT",
  "DAY_OFF",
];

if (status && !validStatuses.includes(status)) {
  return NextResponse.json(
    {
      error: "Status tidak valid",
      code: "VALIDATION_ERROR",
    },
    { status: 400 }
  );
}
```

---

#### T3. N+1 Query Problem di LocationTrackingService

**Lokasi:** `modules/attendance/services/LocationTrackingService.ts` (line 190-216)

**Deskripsi:**

```typescript
const results = await Promise.all(
  activeAttendances.map(async (attendance) => {
    const latestLocation = await prisma.employeeLocation.findFirst({
      where: { userId: attendance.userId },
      orderBy: { recordedAt: "desc" },
    });
    // ...
  })
);
```

Jika ada 100 user aktif, ini akan membuat 100 query tambahan!

**Dampak:** Response time sangat lambat untuk dashboard live tracking.

**Solusi Teknis:**

```typescript
// Batch fetch semua lokasi terakhir dalam 1 query
const userIds = activeAttendances.map((a) => a.userId);

const latestLocations = await prisma.$queryRaw`
    SELECT DISTINCT ON ("userId") *
    FROM "employee_locations"
    WHERE "userId" = ANY(${userIds})
    ORDER BY "userId", "recordedAt" DESC
`;

// Map lokasi ke attendance
const locationMap = new Map(latestLocations.map((l) => [l.userId, l]));
```

---

#### T4. Duplikasi Logic Timezone/Tolerance

**Lokasi:** 3+ files dengan logic identik

| File                                       | Issue                                    |
| ------------------------------------------ | ---------------------------------------- |
| `AttendanceService.ts`                     | Fetch timezone & tolerance settings      |
| `/api/admin/attendance/[id]/route.ts`      | Duplicate fetch & calculation            |
| `/api/mobile/attendance/check-in/route.ts` | Line 29-47 fetch lalu service fetch lagi |

**Dampak:**

- Double database queries
- Potential inconsistency jika logic berbeda

**Solusi Teknis:**

```typescript
// Gunakan AttendanceTimezoneService konsisten di semua tempat
const timezoneService = new AttendanceTimezoneService();
const timezone = await timezoneService.getTimezone();
const tolerance = await timezoneService.getTolerance();
const status = await timezoneService.calculateStatus(checkInTime, scheduleTime);
```

---

#### T5. Mobile Check-in Menerima PhotoURL dari Client

**Lokasi:** `app/api/mobile/attendance/check-in/route.ts` (line 152-157)

**Deskripsi:**

```typescript
if (contentType.includes('application/json')) {
    const body = await request.json()
    photoUrl = body.photoUrl // ❌ Langsung dari client!
```

**Dampak:** Client bisa mengirim URL foto palsu atau foto orang lain.

**Solusi Teknis:**

```typescript
// JSON path seharusnya hanya untuk offline sync dengan signature
if (contentType.includes("application/json")) {
  const body = await request.json();

  // photoUrl harus NULL untuk fresh JSON submissions
  // Hanya terima photoUrl jika ini adalah offline sync DAN sudah diverifikasi
  if (!body._offline_meta) {
    // Reject JSON tanpa offline meta - harus pakai FormData
    return NextResponse.json(
      {
        error: "Fresh submissions must use FormData with photo file",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }
  // ... continue with offline sync logic
}
```

---

### 2.3 🟡 MENENGAH (Perbaikan dalam 2 Minggu)

#### M1. Duplikasi Haversine Formula (3x)

**Lokasi:**

- `modules/attendance/services/GeofenceService.ts` (line 14-28)
- `modules/attendance/services/LocationTrackingService.ts` (line 336-351)
- `mobile/app/(app)/absensi.tsx` (line 31-47)

**Solusi Teknis:**

```typescript
// Buat utility: lib/geo-utils.ts
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (deg: number) => deg * (Math.PI / 180);
  // ... implementation
}

// Import dan gunakan di semua service
import { calculateHaversineDistance } from "@/lib/geo-utils";
```

---

#### M2. Duplikasi Validasi Koordinat (4x)

**Lokasi:**

- `/api/attendance/check-in/route.ts` (line 52-74)
- `/api/mobile/attendance/check-in/route.ts` (line 73-101)
- `/api/mobile/attendance/check-out/route.ts` (line 102-130)
- Multiple lainnya

**Solusi Teknis:**

```typescript
// lib/validation-utils.ts
export function validateCoordinates(
  lat: number,
  lng: number
): {
  valid: boolean;
  error?: string;
} {
  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: "Koordinat tidak valid" };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: "Latitude harus antara -90 dan 90" };
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, error: "Longitude harus antara -180 dan 180" };
  }
  return { valid: true };
}
```

---

#### M3. Inkonsistensi Arsitektur - CheckOut tidak melalui Service

**Lokasi:**

- `/api/attendance/check-out/route.ts` - Direct Prisma update
- `/api/mobile/attendance/check-out/route.ts` - Direct Prisma update

**Deskripsi:** Check-in menggunakan `AttendanceService.checkIn()` yang centralized, tetapi check-out langsung mengakses Prisma.

**Dampak:** Logic checkout tersebar dan tidak konsisten (contoh: geofence validation hanya di mobile).

**Solusi Teknis:**

```typescript
// Buat AttendanceService.checkOut()
async checkOut(params: {
    userId: string
    photoUrl: string | null
    location: string
    latitude?: number
    longitude?: number
}) {
    // 1. Find active attendance
    // 2. Validate geofence (consistently)
    // 3. Calculate duration warnings for FLEXIBLE
    // 4. Update record
    // 5. Return result with warnings
}
```

---

#### M4. Parameter 'status' Tidak Terpakai di Admin List

**Lokasi:** `/api/admin/attendance/route.ts` (line 26)

**Deskripsi:**

```typescript
const status = searchParams.get("status"); // Defined but never used
```

**Solusi Teknis:**

```typescript
// Tambahkan filter
if (status) {
  where.status = status;
}
```

---

#### M5. Data Tidak Terpakai di Analytics Route

**Lokasi:** `/api/attendance/analytics/route.ts` (line 24-25)

**Deskripsi:**

```typescript
const attendanceService = new AttendanceService();
const attendanceData = await attendanceService.getReportData(
  startDate,
  endDate
);
// attendanceData NEVER USED!
```

**Dampak:** Waste of database queries dan processing time.

**Solusi Teknis:**

```typescript
// Hapus jika tidak diperlukan
// const attendanceService = new AttendanceService()
// const attendanceData = await attendanceService.getReportData(startDate, endDate)

// ATAU gunakan datanya
return NextResponse.json({
  success: true,
  data: {
    stats,
    weeklyBreakdown,
    recentAttendance: userAttendances.slice(0, 10),
    globalStats: attendanceData.summary, // <-- Gunakan!
  },
});
```

---

#### M6. Missing Input Validation di Analytics

**Lokasi:** `/api/attendance/analytics/route.ts` (line 19)

**Deskripsi:**

```typescript
const days = parseInt(searchParams.get("days") || "30");
// Tidak ada validasi range
```

**Dampak:** User bisa request `?days=9999999` yang menyebabkan query heavy.

**Solusi Teknis:**

```typescript
const daysRaw = parseInt(searchParams.get("days") || "30");
const days = Math.min(Math.max(daysRaw, 1), 365); // Limit 1-365 days
```

---

### 2.4 🟢 RENDAH (Backlog)

#### R1. Error Response Format Tidak Konsisten

**Lokasi:** Multiple API routes

Beberapa route mengembalikan error tanpa `code` field:

- `/api/attendance/history/route.ts` (line 43)
- `/api/attendance/analytics/route.ts` (line 99)
- `/api/attendance/config/route.ts` (line 48)

**Solusi Teknis:**

```typescript
return NextResponse.json(
  {
    error: "Internal server error",
    code: "INTERNAL_ERROR", // <-- Tambahkan
  },
  { status: 500 }
);
```

---

#### R2. Mobile Warmup Request Menambah Latency

**Lokasi:** `mobile/app/(app)/absensi.tsx` (line 290-300)

**Deskripsi:**

```typescript
// Warm up connection before upload
await axios.get(`${Config.API_URL}/api/health`, ...)
await new Promise(resolve => setTimeout(resolve, 300))
```

**Dampak:** 300ms+ tambahan latency per upload.

**Solusi Teknis:**

```typescript
// Hapus warmup dan gunakan axios interceptor untuk retry
axios.interceptors.response.use(undefined, async (err) => {
  if (err.code === "ECONNRESET" && !err.config.__isRetry) {
    err.config.__isRetry = true;
    return axios(err.config);
  }
  throw err;
});
```

---

#### R3. File Mobile Terlalu Besar (920 lines)

**Lokasi:** `mobile/app/(app)/absensi.tsx`

**Solusi Teknis:**

```
app/(app)/absensi/
├── index.tsx (main screen)
├── components/
│   ├── CameraView.tsx
│   ├── GeofenceWarningModal.tsx
│   ├── WatermarkPhoto.tsx
│   └── StatusCard.tsx
├── hooks/
│   └── useAttendance.ts
└── utils/
    └── photo-processing.ts
```

---

## 3. Ringkasan Temuan

| Prioritas   | Jumlah | Deskripsi                                      |
| ----------- | ------ | ---------------------------------------------- |
| 🔴 Kritis   | 3      | Bug yang berdampak langsung pada data validity |
| 🟠 Tinggi   | 5      | Security concerns dan performance issues       |
| 🟡 Menengah | 6      | Code quality dan maintainability               |
| 🟢 Rendah   | 3      | Minor improvements                             |
| **TOTAL**   | **17** |                                                |

---

## 4. Prioritas Implementasi

### Sprint 1 (Minggu Ini)

- [ ] K1: Fix auto-checkout status consistency
- [ ] K2 & K3: Fix status enum di admin UI
- [ ] T1: Remove console.log dari production
- [ ] T2: Add status validation di admin PATCH

### Sprint 2 (Minggu Depan)

- [ ] T3: Fix N+1 query di LocationTrackingService
- [ ] T4: Centralize timezone/tolerance logic
- [ ] T5: Fix mobile JSON photo validation
- [ ] M3: Create centralized CheckOut service

### Sprint 3 (Bulan Ini)

- [ ] M1 & M2: Extract utility functions
- [ ] M4, M5, M6: Minor fixes
- [ ] R1-R3: Backlog items

---

## 5. Catatan Penting

**Constraint:** Semua perbaikan yang diusulkan **TIDAK** mengubah:

1. ❌ Esensi fitur check-in/check-out
2. ❌ Fungsionalitas inti geofence validation
3. ❌ Logika dasar status calculation (ON_TIME/LATE)
4. ❌ Flow proses bisnis existing
5. ❌ Schema database (tidak ada migration required)

Perbaikan difokuskan pada:

- ✅ Konsistensi data
- ✅ Keamanan
- ✅ Performa
- ✅ Maintainability
- ✅ Code quality

---

**Signed:** Antigravity AI  
**Date:** 13 Januari 2026
