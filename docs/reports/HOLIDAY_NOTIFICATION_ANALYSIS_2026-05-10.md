# Analisis & Implementasi Holiday Notification (ISU #3)

**Tanggal:** 2026-05-10
**Status:** 📋 READY FOR IMPLEMENTATION
**Priority:** LOW
**Estimated Effort:** 2-3 jam

---

## Executive Summary

ISU #3 adalah fitur untuk menambahkan **push notification broadcast** saat admin membuat holiday baru. Saat ini hanya ada activity log, tidak ada notifikasi ke karyawan.

**Impact:** MEDIUM - Meningkatkan awareness karyawan tentang holiday baru
**Complexity:** LOW - Infrastruktur notifikasi sudah lengkap
**Breaking Changes:** ❌ NONE - Pure addition

---

## Problem Statement

### Kondisi Saat Ini

```typescript
// app/api/admin/holidays/route.ts - Line 72-96
const holiday = await holidayService.createHoliday({
  name: validated.name,
  date: validated.date,
  type: validated.type,
  description: validated.description,
  tenantId: ctx.tenantId,
});

// ✅ Activity log ada
await logger.logActivity({
  userId: ctx.userId,
  action: "CREATE",
  entity: "Holiday",
  entityId: holiday.id,
  details: `Created holiday: ${holiday.name}`,
  tenantId: ctx.tenantId,
});

// ❌ Tidak ada notification broadcast ke karyawan
```

**Dampak:**
- Karyawan tidak tahu ada holiday baru sampai mereka buka aplikasi
- Tidak ada real-time awareness tentang perubahan jadwal libur
- Admin harus manual inform via channel lain (WhatsApp, email, dll)

---

## Solution Design

### 1. Notification Infrastructure (Sudah Ada)

**NotificationService** sudah support:
- ✅ Broadcast ke department: `createNotification({ departmentId, ... })`
- ✅ Broadcast ke semua user: Loop through all active users
- ✅ Multi-channel delivery:
  - WebSocket (real-time)
  - FCM Push (Firebase Cloud Messaging)
  - Expo Push (mobile app)
- ✅ Tenant isolation: Otomatis handle via `tenantId`

**File yang relevan:**
- `modules/notification/services/NotificationService.ts` - Main service
- `modules/notification/services/NotificationService.delivery.ts` - Multi-channel delivery
- `modules/notification/services/NotificationService.helpers.ts` - Helper functions

### 2. Notification Type

Tambahkan notification type baru:

```typescript
// modules/notification/types/notification.enums.ts
export enum NotificationType {
  // ... existing types
  HOLIDAY_CREATED = "HOLIDAY_CREATED",  // ✅ NEW
}
```

### 3. Implementation Strategy

**Option A: Broadcast ke Semua User (Recommended)**
```typescript
// Kirim ke semua active users di tenant
const activeUsers = await userLookupService.findAllActiveInTenant(tenantId);
for (const user of activeUsers) {
  await createNotification({
    type: "HOLIDAY_CREATED",
    priority: "NORMAL",
    title: "🎉 Libur Baru Ditambahkan",
    message: `${holiday.name} - ${formatDate(holiday.date)}`,
    link: "/employee/holidays",
    userId: user.id,
    tenantId,
  });
}
```

**Option B: Broadcast ke Department (Alternative)**
```typescript
// Kirim ke semua departments
const departments = await getDepartments(tenantId);
for (const dept of departments) {
  await createNotification({
    type: "HOLIDAY_CREATED",
    priority: "NORMAL",
    title: "🎉 Libur Baru Ditambahkan",
    message: `${holiday.name} - ${formatDate(holiday.date)}`,
    link: "/employee/holidays",
    departmentId: dept.id,
    tenantId,
  });
}
```

**Pilihan:** **Option A** lebih sederhana dan langsung, tidak perlu query departments.

### 4. Message Format

**Title:** `🎉 Libur Baru Ditambahkan`

**Message Format:**
```
{holiday.name} - {formatted_date}
{description (optional)}
```

**Examples:**
- `Hari Raya Idul Fitri - Senin, 10 April 2026`
- `Cuti Bersama - Jumat, 12 April 2026`
- `Libur Nasional: Hari Kemerdekaan - Sabtu, 17 Agustus 2026`

**Link:** `/employee/holidays` atau `/karyawan/holidays`

---

## Implementation Plan

### Step 1: Add Notification Type Enum

**File:** `modules/notification/types/notification.enums.ts`

```typescript
export enum NotificationType {
  // ... existing
  HOLIDAY_CREATED = "HOLIDAY_CREATED",
}
```

### Step 2: Create Holiday Notification Helper

**File:** `modules/notification/services/NotificationService.holiday.ts` (NEW)

```typescript
import type { CreateNotificationData } from "./NotificationService.types";

export type HolidayNotificationData = {
  holidayId: string;
  holidayName: string;
  holidayDate: Date;
  holidayType: string;
  description?: string;
  tenantId: string;
};

export function buildHolidayNotificationTitle(): string {
  return "🎉 Libur Baru Ditambahkan";
}

export function buildHolidayNotificationMessage(
  name: string,
  date: Date,
  description?: string,
): string {
  const formattedDate = date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  let message = `${name} - ${formattedDate}`;
  if (description) {
    message += `\n${description}`;
  }
  
  return message;
}

export function buildHolidayNotificationLink(): string {
  return "/employee/holidays";
}
```

### Step 3: Add Broadcast Function to NotificationService

**File:** `modules/notification/services/NotificationService.ts`

```typescript
import type { HolidayNotificationData } from "./NotificationService.holiday";
import {
  buildHolidayNotificationTitle,
  buildHolidayNotificationMessage,
  buildHolidayNotificationLink,
} from "./NotificationService.holiday";

export async function notifyHolidayCreated(
  data: HolidayNotificationData,
): Promise<void> {
  const userLookupService = getUserLookupService();
  
  // Get all active users in tenant
  const activeUsers = await userLookupService.findAllActiveInTenant(
    data.tenantId,
  );
  
  const title = buildHolidayNotificationTitle();
  const message = buildHolidayNotificationMessage(
    data.holidayName,
    data.holidayDate,
    data.description,
  );
  const link = buildHolidayNotificationLink();
  
  // Broadcast to all active users
  const notifications = activeUsers.map((user) =>
    createNotification({
      type: "HOLIDAY_CREATED",
      priority: "NORMAL",
      title,
      message,
      link,
      userId: user.id,
      sourceType: "Holiday",
      sourceId: data.holidayId,
      tenantId: data.tenantId,
    }),
  );
  
  await Promise.all(notifications);
}
```

### Step 4: Add Method to UserLookupService

**File:** `modules/users/services/UserLookupService.ts`

```typescript
async findAllActiveInTenant(tenantId: string) {
  return this.repository.findManyActive({ tenantId });
}
```

**File:** `modules/users/repositories/UserRepository.ts`

```typescript
async findManyActive(filter: { tenantId: string }) {
  return prisma.user.findMany({
    where: {
      tenantId: filter.tenantId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}
```

### Step 5: Integrate to Holiday Creation API

**File:** `app/api/admin/holidays/route.ts`

```typescript
import { notifyHolidayCreated } from "@/modules/notification";

// After holiday creation (Line ~95)
const holiday = await holidayService.createHoliday({...});

await logger.logActivity({...});

// ✅ NEW: Send notification broadcast
await notifyHolidayCreated({
  holidayId: holiday.id,
  holidayName: holiday.name,
  holidayDate: holiday.date,
  holidayType: holiday.type,
  description: holiday.description || undefined,
  tenantId: ctx.tenantId,
});

return NextResponse.json({...});
```

### Step 6: Export from Module Index

**File:** `modules/notification/index.ts`

```typescript
export { notifyHolidayCreated } from "./services/NotificationService";
export type { HolidayNotificationData } from "./services/NotificationService.holiday";
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/modules/notification/holiday-notification.test.ts` (NEW)

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  buildHolidayNotificationTitle,
  buildHolidayNotificationMessage,
  buildHolidayNotificationLink,
} from "@/modules/notification/services/NotificationService.holiday";

describe("Holiday Notification Helpers", () => {
  it("should build correct title", () => {
    expect(buildHolidayNotificationTitle()).toBe("🎉 Libur Baru Ditambahkan");
  });

  it("should build message with date", () => {
    const date = new Date("2026-04-10");
    const message = buildHolidayNotificationMessage(
      "Hari Raya Idul Fitri",
      date,
    );
    expect(message).toContain("Hari Raya Idul Fitri");
    expect(message).toContain("2026");
  });

  it("should build message with description", () => {
    const date = new Date("2026-04-10");
    const message = buildHolidayNotificationMessage(
      "Cuti Bersama",
      date,
      "Libur nasional",
    );
    expect(message).toContain("Cuti Bersama");
    expect(message).toContain("Libur nasional");
  });

  it("should build correct link", () => {
    expect(buildHolidayNotificationLink()).toBe("/employee/holidays");
  });
});
```

### Integration Tests

**File:** `tests/api/admin-holidays-notification.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/admin/holidays/route";
import * as notificationService from "@/modules/notification";

vi.mock("@/modules/notification", () => ({
  notifyHolidayCreated: vi.fn(),
}));

describe("POST /api/admin/holidays - Notification", () => {
  it("should send notification after creating holiday", async () => {
    const request = new Request("http://localhost/api/admin/holidays", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Holiday",
        date: "2026-12-25",
        type: "NATIONAL",
      }),
    });

    await POST(request);

    expect(notificationService.notifyHolidayCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        holidayName: "Test Holiday",
        holidayType: "NATIONAL",
      }),
    );
  });
});
```

### Manual Testing Checklist

- [ ] Create holiday via admin panel
- [ ] Verify notification appears in employee notification bell
- [ ] Verify push notification received on mobile app
- [ ] Verify WebSocket real-time delivery
- [ ] Verify notification link navigates to `/employee/holidays`
- [ ] Verify tenant isolation (notification only to same tenant users)
- [ ] Verify notification for different holiday types (NATIONAL, COMPANY, RELIGIOUS)

---

## Performance Considerations

### Broadcast Performance

**Scenario:** Tenant dengan 100 karyawan aktif

**Current Approach (Sequential):**
```typescript
for (const user of activeUsers) {
  await createNotification({...});  // Sequential
}
// Time: ~100ms × 100 users = 10 seconds ❌
```

**Optimized Approach (Parallel):**
```typescript
const notifications = activeUsers.map((user) =>
  createNotification({...})
);
await Promise.all(notifications);  // Parallel
// Time: ~100ms (single batch) ✅
```

**Recommendation:** Use `Promise.all()` untuk parallel execution.

### Database Impact

**Queries per Holiday Creation:**
- 1 × INSERT holiday
- 1 × INSERT activity log
- 1 × SELECT active users (N users)
- N × INSERT notifications
- N × SELECT FCM tokens
- N × INSERT push queue

**Total:** ~3N + 2 queries untuk N users

**Optimization:** Batch insert notifications jika perlu (future improvement).

---

## Edge Cases

### 1. Tenant dengan Banyak User (1000+ users)

**Problem:** Broadcast ke 1000+ users bisa lambat.

**Solution:**
- Use background job (Redis Queue) untuk broadcast
- Batch notifications per 100 users
- Add rate limiting untuk push delivery

**Implementation (Future):**
```typescript
// Queue holiday notification job
await queueJob("holiday-notification", {
  holidayId: holiday.id,
  tenantId: ctx.tenantId,
});
```

### 2. User Tidak Punya FCM Token

**Current Behavior:** Skip FCM push, tetap kirim WebSocket + Expo push.

**No Action Needed:** Already handled by delivery service.

### 3. Holiday Dibuat di Luar Jam Kerja

**Current Behavior:** Notification tetap dikirim real-time.

**Consideration:** Apakah perlu delay notification sampai jam kerja?

**Recommendation:** Tidak perlu delay, biarkan real-time. User bisa mute notification di device settings.

### 4. Bulk Holiday Import

**Problem:** Import 10 holidays sekaligus = 10 × N notifications.

**Solution:** Add flag `skipNotification` untuk bulk import.

```typescript
// app/api/admin/holidays/bulk-import/route.ts
for (const holiday of holidays) {
  await holidayService.createHoliday({...});
  // Skip notification during bulk import
}

// Send single summary notification after import
await createNotification({
  title: "📅 Kalender Libur Diperbarui",
  message: `${holidays.length} hari libur baru ditambahkan`,
  ...
});
```

---

## Rollback Plan

Jika ada issue setelah deployment:

```typescript
// Temporary disable notification
// app/api/admin/holidays/route.ts

// Comment out notification call
// await notifyHolidayCreated({...});
```

Atau tambahkan feature flag:

```typescript
const ENABLE_HOLIDAY_NOTIFICATION = process.env.ENABLE_HOLIDAY_NOTIFICATION === "true";

if (ENABLE_HOLIDAY_NOTIFICATION) {
  await notifyHolidayCreated({...});
}
```

---

## Files to Create/Modify

### New Files (2)
1. `modules/notification/services/NotificationService.holiday.ts` - Helper functions
2. `tests/modules/notification/holiday-notification.test.ts` - Unit tests

### Modified Files (5)
1. `modules/notification/types/notification.enums.ts` - Add HOLIDAY_CREATED enum
2. `modules/notification/services/NotificationService.ts` - Add notifyHolidayCreated()
3. `modules/notification/index.ts` - Export new function
4. `modules/users/services/UserLookupService.ts` - Add findAllActiveInTenant()
5. `app/api/admin/holidays/route.ts` - Call notification after creation

### Optional Files (2)
1. `tests/api/admin-holidays-notification.test.ts` - Integration test
2. `modules/users/repositories/UserRepository.ts` - Add findManyActive() if not exists

---

## Deployment Checklist

### Pre-Deployment
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Typecheck passing
- [ ] Lint passing
- [ ] Manual testing completed
- [ ] Performance tested with 100+ users

### Post-Deployment Monitoring
- [ ] Monitor notification delivery rate
- [ ] Monitor push notification success rate
- [ ] Monitor API response time (should stay < 500ms)
- [ ] Check error logs for notification failures
- [ ] Verify tenant isolation working correctly

### Metrics to Track
1. **Notification Delivery Rate:** Target 99%+
2. **Push Success Rate:** Target 95%+ (some users may have invalid tokens)
3. **API Response Time:** Target < 500ms for holiday creation
4. **User Engagement:** Track notification open rate

---

## Future Enhancements

### 1. Notification Preferences
Allow users to opt-out dari holiday notifications:
```typescript
// User settings
notificationPreferences: {
  holidayCreated: boolean;
  leaveApproved: boolean;
  workOrderAssigned: boolean;
}
```

### 2. Digest Notification
Jika banyak holidays dibuat dalam 1 hari, kirim 1 summary notification:
```
📅 3 Hari Libur Baru Ditambahkan
- Hari Raya Idul Fitri (10 Apr)
- Cuti Bersama (11 Apr)
- Cuti Bersama (12 Apr)
```

### 3. Reminder Notification
Kirim reminder H-3 sebelum holiday:
```
🔔 Reminder: Besok Libur
Hari Raya Idul Fitri - Kamis, 10 April 2026
```

---

## Related Issues

### Completed
- ✅ ISU #4: workDays Format Validation (COMPLETED)
- ✅ ISU #10: Overlap Detection (COMPLETED)

### Pending (dari review)
- ⚠️ ISU #7: Auto-Approval Rules (MEDIUM)
- ⚠️ ISU #9: Leave Calendar View (MEDIUM)
- ⚠️ ISU #11: Attachment Validation (MEDIUM)
- ⚠️ ISU #2: Bulk Import Holiday (MEDIUM)
- ⚠️ ISU #6: Bulk Update Working Days (LOW)
- ⚠️ ISU #12: Leave History Export (LOW)

---

## Conclusion

ISU #3 adalah **low-hanging fruit** dengan impact yang baik:
- ✅ Infrastruktur sudah lengkap
- ✅ Implementation straightforward
- ✅ No breaking changes
- ✅ Estimated effort: 2-3 jam
- ✅ High user value (awareness tentang holiday baru)

**Recommendation:** **PROCEED WITH IMPLEMENTATION**

---

**End of Analysis Report**
