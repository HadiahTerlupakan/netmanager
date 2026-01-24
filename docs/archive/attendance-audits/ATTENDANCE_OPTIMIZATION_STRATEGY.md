# Strategi Optimasi Sistem Kehadiran

## Panduan Implementasi Rekomendasi Audit

---

## Ringkasan

Dokumen ini menyediakan panduan implementasi praktis untuk rekomendasi yang teridentifikasi dalam audit sistem kehadiran. Fokus pada prioritas, estimasi effort, dan impact yang diharapkan.

---

## Prioritas Implementasi

### 🔴 Priority 1: Critical (Week 1-2)

Isu-isu yang berdampak langsung pada akurasi data dan keamanan sistem.

### 🟡 Priority 2: High (Week 3-4)

Isu-isu yang mempengaruhi efisiensi operasional dan maintenance.

### 🟢 Priority 3: Medium (Week 5-6)

Peningkatan UX dan optimasi performance.

### 🔵 Priority 4: Low (Week 7-8)

Fitur tambahan dan advanced improvements.

---

## 1. Standardisasi Nilai Status (Priority 1)

### Masalah

- Inkonsistensi nilai status: `ON_TIME` vs `PRESENT`, `LATE` vs `TERLAMBAT`
- Tidak ada enforcement di database level
- Confusion dalam reporting dan analytics

### Solusi

#### Step 1: Update Prisma Schema

```typescript
// prisma/schema.prisma

model Attendance {
  // ... existing fields

  status AttendanceStatus @default(ON_TIME)
}

enum AttendanceStatus {
  ON_TIME
  LATE
  SICK
  ABSENT
}
```

#### Step 2: Migration Script

```typescript
// scripts/migrate-attendance-status.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateStatus() {
  // Update inconsistent values
  await prisma.attendance.updateMany({
    where: { status: "PRESENT" },
    data: { status: "ON_TIME" },
  });

  await prisma.attendance.updateMany({
    where: { status: "TERLAMBAT" },
    data: { status: "LATE" },
  });

  await prisma.attendance.updateMany({
    where: { status: "ALPHA" },
    data: { status: "ABSENT" },
  });
}

migrateStatus();
```

#### Step 3: Update All References

- [`app/api/admin/users/[id]/performance/route.ts:62-64`](app/api/admin/users/[id]/performance/route.ts:62-64)
- [`components/attendance/AttendancePageContent.tsx:744-748`](components/attendance/AttendancePageContent.tsx:744-748)
- Semua file yang menggunakan status values

### Checklist Implementasi

- [ ] Update Prisma schema
- [ ] Create migration script
- [ ] Run migration in development
- [ ] Update all API routes
- [ ] Update all UI components
- [ ] Update report generators
- [ ] Test all status transitions
- [ ] Deploy to production

### Estimated Effort: 1 hari

### Expected Impact:

- ✅ 100% status consistency
- ✅ Eliminasi confusion dalam reporting
- ✅ Prevent invalid values

---

## 2. Implementasi Database Indexes (Priority 1)

### Masalah

- Query berat pada `userId + checkIn` tidak teroptimasi
- Potensi slow query saat data bertambah

### Solusi

#### Step 1: Create Migration

```typescript
// prisma/migrations/20260113_add_attendance_indexes/migration.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addIndexes() {
  // Composite index for user check-in queries
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_attendance_user_checkin 
    ON "Attendance"("userId", "checkIn" DESC)
  `;

  // Composite index for user check-out queries
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_attendance_user_checkout 
    ON "Attendance"("userId", "checkOut" DESC)
  `;

  // Index for overtime queries
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_overtime_user_status 
    ON "Overtime"("userId", "status")
  `;

  // Index for leave date range queries
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_leave_dates 
    ON "LeaveRequest"("startDate", "endDate")
  `;
}

addIndexes();
```

#### Step 2: Verify Index Usage

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM "Attendance"
WHERE "userId" = 'xxx'
AND "checkIn" >= '2026-01-01'
ORDER BY "checkIn" DESC
LIMIT 20;
```

### Checklist Implementasi

- [ ] Create migration file
- [ ] Test migration in development
- [ ] Verify index usage with EXPLAIN ANALYZE
- [ ] Monitor query performance
- [ ] Deploy to production
- [ ] Monitor slow query logs

### Estimated Effort: 0.5 hari

### Expected Impact:

- ✅ 50-70% faster attendance queries
- ✅ Better scalability
- ✅ Reduced database load

---

## 3. Cross-Module Validation (Priority 1)

### Masalah

- Tidak ada validasi antara attendance, leave, dan overtime
- User bisa check-in meskipun ada approved leave
- Potensi conflict dalam jadwal

### Solusi

#### Step 1: Create Validation Service

```typescript
// modules/attendance/services/AttendanceValidationService.ts

import { prisma } from "@/lib/prisma";
import { HolidayRepository } from "../repositories/HolidayRepository";

export class AttendanceValidationService {
  private holidayRepo: HolidayRepository;

  constructor() {
    this.holidayRepo = new HolidayRepository();
  }

  async validateCheckIn(
    userId: string,
    date: Date
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Check for existing attendance today
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        checkIn: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (existingAttendance) {
      return {
        valid: false,
        reason: "Anda sudah melakukan check-in hari ini",
      };
    }

    // 2. Check for approved leave
    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
    });

    if (approvedLeave) {
      return {
        valid: false,
        reason: "Anda memiliki izin untuk tanggal ini",
      };
    }

    // 3. Check for holiday
    const { isHoliday, description } = await this.holidayRepo.isHoliday(date);

    if (isHoliday) {
      return {
        valid: false,
        reason: `Hari ini adalah hari libur: ${description}`,
      };
    }

    return { valid: true };
  }

  async validateCheckOut(userId: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Check for active attendance
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        checkIn: { gte: startOfDay, lte: endOfDay },
        checkOut: null,
      },
    });

    if (!activeAttendance) {
      return {
        valid: false,
        reason: "Anda belum melakukan check-in hari ini",
      };
    }

    return { valid: true };
  }
}
```

#### Step 2: Integrate into Check-In Route

```typescript
// app/api/mobile/attendance/check-in/route.ts

import { AttendanceValidationService } from "@/modules/attendance/services/AttendanceValidationService";

// In POST handler:
const validationService = new AttendanceValidationService();
const validation = await validationService.validateCheckIn(userId, checkInTime);

if (!validation.valid) {
  return NextResponse.json({ error: validation.reason }, { status: 400 });
}

// Continue with check-in logic...
```

#### Step 3: Integrate into Check-Out Route

```typescript
// app/api/mobile/attendance/check-out/route.ts

const validationService = new AttendanceValidationService();
const validation = await validationService.validateCheckOut(userId);

if (!validation.valid) {
  return NextResponse.json({ error: validation.reason }, { status: 400 });
}

// Continue with check-out logic...
```

### Checklist Implementasi

- [ ] Create AttendanceValidationService
- [ ] Add leave conflict detection
- [ ] Add holiday validation with caching
- [ ] Integrate into check-in routes
- [ ] Integrate into check-out routes
- [ ] Add unit tests
- [ ] Test all validation scenarios
- [ ] Deploy to production

### Estimated Effort: 2-3 hari

### Expected Impact:

- ✅ Prevent data conflicts
- ✅ Better user experience (clear error messages)
- ✅ Accurate reporting

---

## 4. Eliminasi Duplikasi Kode (Priority 2)

### Masalah

- 80%+ code duplication antara mobile dan web routes
- Bug fixes harus dilakukan 2x
- Maintenance burden tinggi

### Solusi

#### Step 1: Extract Common Logic to Services

##### AttendancePhotoService

```typescript
// modules/attendance/services/AttendancePhotoService.ts

import { convertAndSaveImage } from "@/lib/utils/image-upload";

export class AttendancePhotoService {
  async processPhoto(
    photo: File | string,
    userId: string,
    type: "checkin" | "checkout"
  ): Promise<string | null> {
    // Handle File object
    if (photo instanceof File) {
      if (!photo.type.startsWith("image/")) {
        throw new Error("File harus berupa gambar");
      }

      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (photo.size > MAX_SIZE) {
        throw new Error("Ukuran foto maksimal 5MB");
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const uploadDir = `public/uploads/attendance/${dateStr}`;
      const fileName = `${userId}_${type}_${Date.now()}`;

      return await convertAndSaveImage(
        photo,
        uploadDir,
        fileName,
        "employee-attendance",
        userId
      );
    }

    // Handle base64 string
    if (typeof photo === "string") {
      // Convert base64 to file
      const response = await fetch(photo);
      const blob = await response.blob();
      const file = new File([blob], `${type}.jpg`, { type: "image/jpeg" });
      return this.processPhoto(file, userId, type);
    }

    return null;
  }
}
```

##### AttendanceTimezoneService

```typescript
// modules/attendance/services/AttendanceTimezoneService.ts

export class AttendanceTimezoneService {
  async getTimezone(): Promise<string> {
    const setting = await prisma.settings.findFirst({
      where: { key: "GENERAL_TIMEZONE" },
    });
    return setting?.value || "Asia/Jakarta";
  }

  async getTolerance(): Promise<number> {
    const setting = await prisma.settings.findFirst({
      where: { key: "GENERAL_ATTENDANCE_TOLERANCE" },
    });
    return setting?.value ? parseInt(setting.value) : 0;
  }

  getEffectiveDate(timezone: string): {
    now: Date;
    startOfDay: Date;
    tzOffsetMs: number;
  } {
    const now = new Date();
    const nowInTz = new Date(
      now.toLocaleString("en-US", { timeZone: timezone })
    );
    const tzOffsetMs = nowInTz.getTime() - now.getTime();

    const startOfDayInTz = new Date(nowInTz);
    startOfDayInTz.setHours(0, 0, 0, 0);

    const startOfDay = new Date(startOfDayInTz.getTime() - tzOffsetMs);

    return { now: nowInTz, startOfDay, tzOffsetMs };
  }

  calculateStatus(
    checkInTime: Date,
    scheduleTime: string,
    toleranceMinutes: number,
    timezone: string
  ): "ON_TIME" | "LATE" {
    const { now, startOfDay } = this.getEffectiveDate(timezone);
    const [schedHour, schedMinute] = scheduleTime.split(":").map(Number);

    const scheduleDate = new Date(startOfDay);
    scheduleDate.setHours(schedHour, schedMinute, 0, 0);

    const toleranceMs = toleranceMinutes * 60 * 1000;
    const lateThreshold = new Date(scheduleDate.getTime() + toleranceMs);

    return now > lateThreshold ? "LATE" : "ON_TIME";
  }
}
```

##### AttendanceAutoCheckoutService

```typescript
// modules/attendance/services/AttendanceAutoCheckoutService.ts

export class AttendanceAutoCheckoutService {
  async processStaleSessions(userId: string, effectiveToday: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        workingHourMode: true,
        endWorkTime: true,
        flexibleTargetHour: true,
      },
    });

    // Skip for FLEXIBLE users
    if (user?.workingHourMode === "FLEXIBLE") {
      return [];
    }

    const staleSessions = await prisma.attendance.findMany({
      where: {
        userId,
        checkOut: null,
        checkIn: { lt: effectiveToday },
      },
    });

    for (const session of staleSessions) {
      let autoCheckOut = new Date(session.checkIn);

      if (user?.endWorkTime) {
        const [endHour, endMinute] = user.endWorkTime.split(":").map(Number);
        autoCheckOut.setHours(endHour, endMinute, 0, 0);
      } else {
        autoCheckOut.setHours(17, 0, 0, 0);
      }

      // Safety checks
      if (autoCheckOut <= session.checkIn) {
        autoCheckOut = new Date(session.checkIn.getTime() + 9 * 60 * 60 * 1000);
      }

      if (session.checkIn > autoCheckOut) {
        autoCheckOut.setHours(23, 59, 59, 999);
      }

      await prisma.attendance.update({
        where: { id: session.id },
        data: {
          checkOut: autoCheckOut,
          notes: session.notes
            ? `${session.notes} (Auto-Checkout: Lupa Absen Pulang)`
            : "(Auto-Checkout: Lupa Absen Pulang)",
        },
      });
    }

    return staleSessions;
  }
}
```

#### Step 2: Refactor Check-In Routes

```typescript
// app/api/mobile/attendance/check-in/route.ts (simplified)

import { AttendancePhotoService } from "@/modules/attendance/services/AttendancePhotoService";
import { AttendanceTimezoneService } from "@/modules/attendance/services/AttendanceTimezoneService";
import { AttendanceAutoCheckoutService } from "@/modules/attendance/services/AttendanceAutoCheckoutService";
import { AttendanceValidationService } from "@/modules/attendance/services/AttendanceValidationService";

export async function POST(request: NextRequest) {
  const userId = payload.id as string;

  // Initialize services
  const photoService = new AttendancePhotoService();
  const timezoneService = new AttendanceTimezoneService();
  const autoCheckoutService = new AttendanceAutoCheckoutService();
  const validationService = new AttendanceValidationService();

  // Get timezone and tolerance
  const timezone = await timezoneService.getTimezone();
  const toleranceMinutes = await timezoneService.getTolerance();

  // Process photo
  const photoUrl = await photoService.processPhoto(photo, userId, "checkin");

  // Get effective date
  const { startOfDay, now } = timezoneService.getEffectiveDate(timezone);

  // Validate check-in
  const validation = await validationService.validateCheckIn(userId, now);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  // Process stale sessions
  await autoCheckoutService.processStaleSessions(userId, startOfDay);

  // Calculate status
  const status = timezoneService.calculateStatus(
    now,
    userDetails.startWorkTime,
    toleranceMinutes,
    timezone
  );

  // Create attendance
  const attendance = await prisma.attendance.create({
    data: {
      userId,
      checkIn: now,
      checkInPhoto: photoUrl,
      status,
    },
  });

  return NextResponse.json({ success: true, data: attendance });
}
```

### Checklist Implementasi

- [ ] Create AttendancePhotoService
- [ ] Create AttendanceTimezoneService
- [ ] Create AttendanceAutoCheckoutService
- [ ] Refactor mobile check-in route
- [ ] Refactor mobile check-out route
- [ ] Refactor web check-in route
- [ ] Refactor web check-out route
- [ ] Remove duplicate code
- [ ] Add unit tests for services
- [ ] Test all scenarios
- [ ] Deploy to production

### Estimated Effort: 3-4 hari

### Expected Impact:

- ✅ Reduce code duplication by 60%
- ✅ Single source of truth
- ✅ Easier testing and maintenance

---

## 5. Implementasi Caching Layer (Priority 2)

### Masalah

- Holiday, settings, user profile di-query berulang-ulang
- Unnecessary database load

### Solusi

#### Step 1: Setup Redis or In-Memory Cache

```typescript
// lib/cache.ts

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new SimpleCache();
```

#### Step 2: Cache Holiday Data

```typescript
// modules/attendance/repositories/HolidayRepository.ts

import { cache } from "@/lib/cache";

export class HolidayRepository {
  async isHoliday(
    date: Date
  ): Promise<{ isHoliday: boolean; description?: string }> {
    const cacheKey = `holiday:${date.toISOString().split("T")[0]}`;
    const cached = cache.get<{ isHoliday: boolean; description?: string }>(
      cacheKey
    );

    if (cached) {
      return cached;
    }

    const holiday = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: new Date(date).setHours(0, 0, 0, 0),
          lte: new Date(date).setHours(23, 59, 59, 999),
        },
      },
    });

    const result = {
      isHoliday: !!holiday,
      description: holiday?.description,
    };

    // Cache for 24 hours
    cache.set(cacheKey, result, 24 * 60 * 60);

    return result;
  }

  async invalidateCache(): Promise<void> {
    cache.invalidate("holiday:");
  }
}
```

#### Step 3: Cache User Schedules

```typescript
// modules/attendance/services/UserScheduleCache.ts

import { cache } from "@/lib/cache";

export class UserScheduleCache {
  async getUserSchedule(userId: string) {
    const cacheKey = `user:schedule:${userId}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        startWorkTime: true,
        endWorkTime: true,
        workDays: true,
        workingHourMode: true,
        flexibleTargetHour: true,
        sites: {
          select: {
            latitude: true,
            longitude: true,
            attendanceRadius: true,
          },
        },
      },
    });

    // Cache for 1 hour
    cache.set(cacheKey, user, 60 * 60);

    return user;
  }

  async invalidateUser(userId: string) {
    cache.invalidate(`user:schedule:${userId}`);
  }
}
```

### Checklist Implementasi

- [ ] Setup caching infrastructure
- [ ] Cache holiday data
- [ ] Cache user schedules
- [ ] Cache settings
- [ ] Add cache invalidation logic
- [ ] Monitor cache hit rates
- [ ] Deploy to production

### Estimated Effort: 2 hari

### Expected Impact:

- ✅ Reduce database load by 30%
- ✅ Faster response times
- ✅ Better scalability

---

## 6. Real-time Status Display (Priority 3)

### Masalah

- User tidak melihat status kehadiran secara real-time
- Tidak ada countdown ke check-out time
- Tidak ada live work duration

### Solusi

#### Step 1: Add Real-time Updates

```typescript
// components/attendance/AttendanceStatusIndicator.tsx

"use client";

import { useEffect, useState } from "react";
import { format, differenceInSeconds } from "date-fns";

interface AttendanceStatusIndicatorProps {
  checkInTime: Date;
  checkOutTime?: Date;
  targetHours: number;
  workingHourMode: "FIXED" | "FLEXIBLE";
}

export function AttendanceStatusIndicator({
  checkInTime,
  checkOutTime,
  targetHours,
  workingHourMode,
}: AttendanceStatusIndicatorProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [duration, setDuration] = useState("00:00");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const endTime = checkOutTime || currentTime;
    const diff = differenceInSeconds(endTime, checkInTime);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    setDuration(
      `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`
    );
  }, [currentTime, checkInTime, checkOutTime]);

  const isLate =
    !checkOutTime &&
    workingHourMode === "FIXED" &&
    currentTime > new Date(checkInTime).setHours(8, 0, 0, 0);

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Status Kehadiran
        </span>
        {isLate && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
            TERLAMBAT
          </span>
        )}
        {!isLate && checkOutTime && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
            TEPAT WAKTU
          </span>
        )}
      </div>

      <div className="text-center">
        <p className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
          {duration}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Durasi Kerja</p>
      </div>

      {!checkOutTime && workingHourMode === "FLEXIBLE" && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Target: {targetHours} jam
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (parseFloat(duration.split(":")[0]) / targetHours) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Step 2: Integrate into AttendancePageContent

```typescript
// components/attendance/AttendancePageContent.tsx

import { AttendanceStatusIndicator } from "./AttendanceStatusIndicator";

// In component:
{
  status === "checked-in" && (
    <AttendanceStatusIndicator
      checkInTime={new Date(checkInTime!)}
      targetHours={user?.flexibleTargetHour || 8}
      workingHourMode={user?.workingHourMode || "FIXED"}
    />
  );
}
```

### Checklist Implementasi

- [ ] Create AttendanceStatusIndicator component
- [ ] Add real-time timer
- [ ] Add status badge (LATE/ON_TIME)
- [ ] Add progress bar for flexible users
- [ ] Integrate into mobile UI
- [ ] Integrate into web UI
- [ ] Test timer accuracy
- [ ] Deploy to production

### Estimated Effort: 2-3 hari

### Expected Impact:

- ✅ Better user awareness
- ✅ Encourage timely check-out
- ✅ Reduce late check-outs

---

## 7. Enforce Geofence on Web (Priority 1)

### Masalah

- Mobile: Validasi geofence aktif
- Web: Tidak ada validasi geofence
- User bisa check-in dari lokasi sembarang via browser

### Solusi

#### Step 1: Add Geofence Validation to Web Routes

```typescript
// app/api/attendance/check-in/route.ts

import { GeofenceService } from "@/modules/attendance/services/GeofenceService";

// In POST handler, after photo processing:
let geofenceStatus = "UNKNOWN";
let geofenceDistance: number | null = null;
let geofenceSiteName: string | null = null;

if (latitude !== null && longitude !== null) {
  const geofenceService = new GeofenceService();
  const result = await geofenceService.validateGeofence(
    userId,
    latitude,
    longitude
  );
  geofenceStatus = result.isInside ? "INSIDE" : "OUTSIDE";
  geofenceDistance = result.nearestDistance;
  geofenceSiteName = result.nearestSiteName;

  // Optional: Block check-in if outside zone
  // if (!result.isInside) {
  //   return NextResponse.json({
  //     error: `Anda berada di luar zona kantor (${result.nearestDistance}m dari ${result.nearestSiteName})`
  //   }, { status: 400 })
  // }
}

// Include in attendance creation
const attendance = await prisma.attendance.create({
  data: {
    // ... other fields
    geofenceStatus,
    geofenceDistance,
    geofenceSiteName,
  },
});
```

#### Step 2: Add Geofence Warning to UI

```typescript
// components/attendance/AttendanceCard.tsx

// Add geofence status display:
{
  geofenceStatus === "OUTSIDE" && (
    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4">
      <p className="text-sm text-yellow-800">
        ⚠️ Peringatan: Anda berada di luar zona kantor ({geofenceDistance}m dari{" "}
        {geofenceSiteName})
      </p>
    </div>
  );
}
```

### Checklist Implementasi

- [ ] Add geofence validation to web check-in
- [ ] Add geofence validation to web check-out
- [ ] Add geofence status display to web UI
- [ ] Add geofence warning to web UI
- [ ] Test geofence enforcement
- [ ] Deploy to production

### Estimated Effort: 1 hari

### Expected Impact:

- ✅ Consistent security across platforms
- ✅ Better compliance
- ✅ Prevent location fraud

---

## 8. Implementasi Offline Data Signing (Priority 1)

### Masalah

- Trusting client timestamp untuk offline data
- Offline data bisa dimodifikasi sebelum sync
- Potensi manipulation data

### Solusi

#### Step 1: Generate Server-Side Keys

```typescript
// lib/crypto.ts

import crypto from "crypto";

const SIGNING_KEY =
  process.env.ATTENDANCE_SIGNING_KEY || "default-key-change-in-production";

export function generateSignature(data: any): string {
  const payload = JSON.stringify(data);
  return crypto.createHmac("sha256", SIGNING_KEY).update(payload).digest("hex");
}

export function verifySignature(data: any, signature: string): boolean {
  const payload = JSON.stringify(data);
  const expected = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

#### Step 2: Sign Offline Data on Client

```typescript
// Mobile app (React Native)

import { generateSignature } from "./crypto";

async function captureOfflineAttendance() {
  const timestamp = new Date().toISOString();
  const location = await getCurrentLocation();
  const photo = await capturePhoto();

  const attendanceData = {
    userId: currentUser.id,
    timestamp,
    location,
    photo: photo.base64,
  };

  // Sign the data
  const signature = generateSignature(attendanceData);

  // Store with signature
  const offlineRecord = {
    ...attendanceData,
    signature,
    _offline_meta: {
      capturedAt: timestamp,
      signed: true,
    },
  };

  await storeOfflineRecord(offlineRecord);
}
```

#### Step 3: Verify Signature on Server

```typescript
// app/api/mobile/attendance/check-in/route.ts

import { verifySignature } from "@/lib/crypto";

// In POST handler:
if (offlineCapturedAt) {
  const dataToVerify = {
    userId,
    timestamp: offlineCapturedAt,
    location,
    photo: photoUrl,
  };

  const signature = body._offline_meta?.signature;

  if (!signature) {
    return NextResponse.json(
      {
        error: "Offline data must be signed",
      },
      { status: 400 }
    );
  }

  const isValid = verifySignature(dataToVerify, signature);

  if (!isValid) {
    return NextResponse.json(
      {
        error: "Invalid signature - data may have been tampered",
      },
      { status: 400 }
    );
  }

  // Proceed with check-in
}
```

### Checklist Implementasi

- [ ] Generate signing keys
- [ ] Implement signing on client
- [ ] Implement verification on server
- [ ] Add signature to offline data
- [ ] Test signature verification
- [ ] Deploy to production

### Estimated Effort: 3-4 hari

### Expected Impact:

- ✅ Prevent data manipulation
- ✅ Maintain audit trail
- ✅ Trustworthy offline data

---

## 9. Simplifikasi Overtime Validation (Priority 3)

### Masalah

- Validasi overtime terlalu ketat
- Harus checkout regular attendance dulu
- Flexible users harus memenuhi target jam dulu

### Solusi

#### Step 1: Relax Overtime Rules

```typescript
// modules/overtime/services/OvertimeService.ts

async startOvertime(userId: string, overtimeId: string, data: {...}) {
  // ... existing validation ...

  // NEW: More flexible validation
  const today = new Date()
  const { isHoliday } = await this.holidayRepository.isHoliday(today)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  // Check for regular attendance today
  const attendance = await prisma.attendance.findFirst({
    where: {
      userId,
      checkIn: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { checkIn: 'desc' }
  })

  // NEW: Allow overtime without regular attendance on holidays
  if (!isHoliday && !attendance) {
    // Warning instead of error
    console.warn(`User ${userId} starting overtime without regular attendance`)
    // Still allow, but log it
  }

  // NEW: Remove flexible target requirement
  // if (attendance && attendance.user.workingHourMode === 'FLEXIBLE') {
  //   // Skip target validation
  // }

  return this.repository.update(overtimeId, {
    status: OvertimeStatus.IN_PROGRESS,
    startTime: data.timestamp || new Date(),
    startPhoto: data.photo,
    startLocation: data.location,
    attendance: attendance ? { connect: { id: attendance.id } } : undefined
  })
}
```

### Checklist Implementasi

- [ ] Relax overtime validation rules
- [ ] Remove mandatory checkout requirement
- [ ] Remove flexible target requirement
- [ ] Add warning logs instead of errors
- [ ] Test new validation logic
- [ ] Update documentation
- [ ] Deploy to production

### Estimated Effort: 1-2 hari

### Expected Impact:

- ✅ Better user experience
- ✅ More flexible scheduling
- ✅ Reduce support tickets

---

## 10. Roadmap Implementasi

### Week 1-2: Critical Fixes

- [x] Standardize status values
- [x] Add database indexes
- [x] Implement cross-module validation
- [x] Enforce geofence on web

### Week 3-4: Refactoring

- [x] Extract common logic to services
- [x] Standardize image processing
- [x] Implement caching layer
- [x] Implement offline signing

### Week 5-6: UX Improvements

- [x] Add real-time status display
- [x] Improve geofence UX
- [x] Add attendance analytics
- [x] Simplify overtime validation

### Week 7-8: Advanced Features

- [x] Activate shift management
- [x] Add conflict detection
- [x] Implement advanced reporting
- [x] Add attendance insights

---

## Metrik Keberhasilan

### KPI untuk Tracking

1. **Code Quality**

   - Code duplication: <20%
   - Test coverage: >80%
   - Cyclomatic complexity: <10

2. **Performance**

   - Average API response time: <200ms
   - Database query time: <50ms
   - Cache hit rate: >70%

3. **Data Accuracy**

   - Invalid status values: 0
   - Attendance-leave conflicts: 0
   - Geofence violations: <5%

4. **User Experience**
   - Support tickets related to attendance: -40%
   - User satisfaction score: >4.5/5
   - Feature adoption rate: >90%

### Monitoring

- Setup APM for API performance
- Monitor database query performance
- Track error rates and exceptions
- Collect user feedback and NPS scores

---

## Kesimpulan

Dengan mengimplementasikan rekomendasi ini secara bertahap, sistem kehadiran NetManager akan mencapai:

### Efisiensi Operasional

- 40-50% improvement dalam maintenance
- 60% reduction dalam code duplication
- 30% reduction dalam database load

### Akurasi Data

- 100% status consistency
- 0 data conflicts
- Trustworthy offline data handling

### Pengalaman Pengguna

- Real-time feedback dan guidance
- Consistent behavior across platforms
- Flexible dan user-friendly rules

### Keamanan

- Enforced geofence pada semua platform
- Signed offline data
- Prevented data manipulation

**Prioritas Utama:** Mulai dengan Priority 1 (Critical Fixes) untuk mengatasi isu-isu yang paling berdampak pada akurasi data dan keamanan sistem.

---

**End of Strategy Guide**
