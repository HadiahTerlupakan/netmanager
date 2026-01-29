# 🔧 FRONTEND BUG FIX - IMPLEMENTATION PLAN

**Created:** 2026-01-28  
**Based on:** [`docs/FRONTEND_BUG_AUDIT_REPORT.md`](../docs/FRONTEND_BUG_AUDIT_REPORT.md)  
**Strategy:** Comprehensive fix untuk semua 7 bugs sebelum deploy

---

## 📋 IMPLEMENTATION ROADMAP

### **PHASE 1: INFRASTRUCTURE** ⚙️

**Timeline:** 2-3 hours  
**Priority:** Foundation untuk semua fixes

#### 1.1 Create Fetch Wrapper with Error Handling

**File:** `lib/api/fetch-wrapper.ts`

- Centralized error handling
- Rate limit detection & feedback
- Automatic retry-after parsing
- Response normalization

#### 1.2 Create Toast Notification Hook

**File:** `hooks/use-toast.ts`

- Replace native alert()
- Support success/error/warning/info
- Auto-dismiss with configurable duration
- Queue management untuk multiple toasts

#### 1.3 Install Dependencies

```bash
npm install date-fns
```

---

### **PHASE 2: CRITICAL BUGS (P0)** 🚨

**Timeline:** 4-7 hours  
**Priority:** Must fix before deploy

#### 2.1 Bug #1: Missing Error Response Handling

**Files to update:**

- `app/admin/lembur/LemburClient.tsx`
- `app/admin/attendance/AttendanceClient.tsx`
- `app/admin/kehadiran/laporan/ReportClient.tsx`
- `app/admin/my-profile/MyProfileClient.tsx`
- `app/admin/ftth/odp/*/OdpEditClient.tsx`

**Changes:**

```typescript
// Before
const res = await fetch("/api/admin/lembur");
if (res.ok) {
  // success
}
// ❌ No error handling

// After
const res = await fetchWithErrorHandling("/api/admin/lembur");
if (res.ok) {
  const data = await res.json();
  // success
} else {
  const error = await res.json().catch(() => ({ error: "Unknown error" }));
  showToast({
    type: "error",
    message: error.error || "Gagal memuat data",
  });
  console.error("API Error:", error);
}
```

#### 2.2 Bug #7: No Rate Limit User Feedback

**Implementation:** In fetch wrapper

- Detect HTTP 429 status
- Extract Retry-After header
- Show user-friendly countdown
- Optional: Disable buttons temporarily

**Code:**

```typescript
if (res.status === 429) {
  const retryAfter = res.headers.get("Retry-After");
  const errorData = await res
    .json()
    .catch(() => ({ error: "Rate limit exceeded" }));

  showToast({
    type: "warning",
    message: `${errorData.error}. Tunggu ${retryAfter} detik.`,
    duration: Math.min(parseInt(retryAfter || "60") * 1000, 10000),
  });

  throw new Error("RATE_LIMIT_EXCEEDED");
}
```

#### 2.3 Bug #3: Client-Side Filtering Breaking Pagination

**Option A: Backend Update (Preferred)**

**Backend File:** `app/api/admin/lembur/route.ts`

```typescript
// Add holidayType query param
const holidayType = searchParams.get("holidayType");

let where: Prisma.OvertimeWhereInput = {
  /* ... */
};

// Add holiday filter
if (holidayType) {
  switch (holidayType) {
    case "REGULAR":
      where.isHolidayOvertime = false;
      break;
    case "NATIONAL":
      where.isNationalHoliday = true;
      break;
    case "COLLECTIVE":
      where.AND = [
        { isHolidayOvertime: true },
        { isNationalHoliday: false },
        { isOffDay: false },
      ];
      break;
    case "OFFDAY":
      where.isOffDay = true;
      break;
    case "ALL_HOLIDAY":
      where.isHolidayOvertime = true;
      break;
  }
}
```

**Frontend File:** `app/admin/lembur/LemburClient.tsx`

```typescript
// Remove client-side filtering, pass to backend
const query = new URLSearchParams({
  page: page.toString(),
  limit: "10",
  ...(holidayFilter && { holidayType: holidayFilter }), // ✅ Backend filtering
  ...(startDate && { startDate }),
  ...(endDate && { endDate }),
  ...(statusFilter && { status: statusFilter }),
  ...(siteId && { siteId }),
  ...(departmentId && { departmentId }),
});

const res = await fetch(`/api/admin/lembur?${query.toString()}`);
if (res.ok) {
  const data = await res.json();
  setRequests(data.data); // ✅ No client filtering needed
  setTotalPages(data.pagination?.totalPages || 1);
  setTotalItems(data.pagination?.total || 0);
}
```

---

### **PHASE 3: HIGH PRIORITY (P1)** ⚠️

**Timeline:** 3-6 hours  
**Priority:** Should deploy together with P0

#### 3.1 Bug #2: Alert() Usage

**Files to update:** Same as Bug #1

- Replace all `alert()` calls with `showToast()`
- Consistent error display
- Non-blocking UX

**Pattern:**

```typescript
// Before
alert(data.error || "Gagal memproses permintaan");

// After
showToast({
  type: "error",
  message: data.error || "Gagal memproses permintaan",
});
```

#### 3.2 Bug #4: Missing Frontend Validation

**File:** `app/admin/lembur/LemburClient.tsx`

**Add validation function:**

```typescript
const validateEditForm = (): string[] => {
  const errors: string[] = [];

  // Reason validation (match backend schema)
  if (!editForm.reason.trim()) {
    errors.push("Alasan lembur wajib diisi");
  } else if (editForm.reason.length < 10) {
    errors.push("Alasan lembur minimal 10 karakter");
  } else if (editForm.reason.length > 500) {
    errors.push("Alasan lembur maksimal 500 karakter");
  }

  // Time logic validation
  if (editForm.startTime && editForm.endTime) {
    const start = new Date(editForm.startTime);
    const end = new Date(editForm.endTime);
    if (end <= start) {
      errors.push("Jam selesai harus lebih besar dari jam mulai");
    }

    // Check if duration is reasonable (e.g., max 12 hours)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > 12) {
      errors.push("Durasi lembur maksimal 12 jam");
    }
  }

  return errors;
};

const handleEditSubmit = async () => {
  if (!editId) return;

  // ✅ Validate before API call
  const errors = validateEditForm();
  if (errors.length > 0) {
    showToast({
      type: "error",
      message: errors.join(". "),
    });
    return;
  }

  setProcessingId(editId);
  // ... proceed with API call
};
```

**Add real-time validation feedback in JSX:**

```tsx
<textarea
    className={`w-full p-2 border rounded-lg ${
        editForm.reason.length > 0 && editForm.reason.length < 10
            ? 'border-red-500'
            : 'border-gray-300'
    }`}
    value={editForm.reason}
    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
/>
<span className="text-xs text-gray-500">
    {editForm.reason.length}/500 karakter {editForm.reason.length < 10 && '(minimal 10)'}
</span>
```

#### 3.3 Bug #6: Timezone Handling Issue

**Install date-fns already done in Phase 1**

**Update datetime handling:**

```typescript
import { format, parseISO } from "date-fns";

// ✅ Proper format for datetime-local input
const formatForInput = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "yyyy-MM-dd'T'HH:mm");
  } catch (error) {
    console.error("Invalid date:", dateStr);
    return "";
  }
};

// ✅ Proper conversion to ISO for API
const handleEditSubmit = async () => {
  // ...
  const payload: any = {
    reason: editForm.reason.trim(),
  };

  if (editForm.startTime) {
    payload.startTime = new Date(editForm.startTime).toISOString();
  }
  if (editForm.endTime) {
    payload.endTime = new Date(editForm.endTime).toISOString();
  }

  // ... API call
};
```

---

### **PHASE 4: OPTIMIZATION (P2)** 📈

**Timeline:** 1-2 hours  
**Priority:** Nice-to-have, can defer

#### 4.1 Bug #5: Race Condition in State Updates

**File:** `app/admin/lembur/LemburClient.tsx`

**Implement AbortController:**

```typescript
useEffect(() => {
  const controller = new AbortController();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        /* ... */
      });
      const res = await fetch(`/api/admin/lembur?${query}`, {
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        setRequests(data.data);
        // ...
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Request aborted - newer request in flight");
        return;
      }
      // Handle other errors
      console.error("Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoading) fetchData();

  return () => {
    controller.abort(); // Cleanup on unmount or dependency change
  };
}, [
  page,
  startDate,
  endDate,
  statusFilter,
  siteId,
  departmentId,
  holidayFilter,
]);
```

**Add debounce for filter changes:**

```typescript
import { useState, useEffect } from "react";

// Debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// Usage
const debouncedStartDate = useDebounce(startDate, 300);
const debouncedEndDate = useDebounce(endDate, 300);

useEffect(() => {
  // Fetch using debounced values
}, [debouncedStartDate, debouncedEndDate /* other filters */]);
```

---

## 📂 FILES TO CREATE

### Infrastructure

1. ✅ `lib/api/fetch-wrapper.ts` - Centralized fetch with error handling
2. ✅ `hooks/use-toast.ts` - Toast notification hook
3. ✅ `components/ui/Toast.tsx` - Toast component (if not exists)

### Utilities

4. ✅ `lib/utils/datetime.ts` - Date formatting utilities with date-fns
5. ✅ `lib/utils/validation.ts` - Reusable validation functions

---

## 📝 FILES TO MODIFY

### Backend (for Bug #3)

1. ✅ `app/api/admin/lembur/route.ts` - Add holidayType filter

### Frontend Components

2. ✅ `app/admin/lembur/LemburClient.tsx` - All 7 bugs fixes
3. ✅ `app/admin/attendance/AttendanceClient.tsx` - Bugs #1, #2, #7
4. ✅ `app/admin/kehadiran/laporan/ReportClient.tsx` - Bugs #1, #2, #7
5. ✅ `app/admin/my-profile/MyProfileClient.tsx` - Bugs #1, #2, #7
6. ✅ `app/admin/ftth/odp/[id]/edit/OdpEditClient.tsx` - Bugs #1, #2, #7
7. ✅ `app/admin/ftth/odp/new/OdpNewClient.tsx` - Bugs #1, #2, #7

---

## ✅ TESTING CHECKLIST

### Unit Testing

- [ ] Test fetch wrapper with different error codes (400, 401, 403, 429, 500)
- [ ] Test toast notifications display correctly
- [ ] Test validation functions with edge cases
- [ ] Test datetime formatting with different timezones

### Integration Testing

- [ ] Test error handling in LemburClient
- [ ] Test rate limit behavior (trigger 429)
- [ ] Test pagination with backend filtering
- [ ] Test form submission with validation
- [ ] Test AbortController cancellation

### Manual Testing

- [ ] Test all error scenarios in UI
- [ ] Test toast notifications appearance
- [ ] Test form validation feedback
- [ ] Test rapid filter changes (race condition)
- [ ] Test rate limit user experience
- [ ] Test datetime input/display across timezones

### Edge Cases

- [ ] Network offline behavior
- [ ] Slow network responses
- [ ] Rapid button clicks
- [ ] Invalid date inputs
- [ ] Unicode characters in reason field
- [ ] Very long reason text (500 chars)

---

## 📊 SUCCESS METRICS

### Before Implementation

- ❌ Error visibility: 0%
- ❌ Rate limit feedback: None
- ❌ Pagination accuracy: Broken
- ❌ Frontend validation: 40%
- ❌ User confusion: High

### After Implementation

- ✅ Error visibility: 100%
- ✅ Rate limit feedback: Clear
- ✅ Pagination accuracy: 100%
- ✅ Frontend validation: 100%
- ✅ Network requests: -20%
- ✅ User confusion: Low

---

## 🚀 DEPLOYMENT PLAN

### Pre-Deployment

1. ✅ All 7 bugs fixed
2. ✅ All tests passing
3. ✅ Code review completed
4. ✅ Documentation updated

### Deployment Steps

1. Deploy backend changes first (Bug #3 filter)
2. Deploy frontend changes
3. Monitor error rates in Sentry
4. Monitor rate limit hit frequency
5. Collect user feedback

### Rollback Plan

- Keep previous version deployable
- Feature flag for new error handling
- Database migrations are backward compatible

---

## 📋 DEPENDENCIES

```json
{
  "dependencies": {
    "date-fns": "^3.0.0"
  }
}
```

---

## 🎯 PRIORITY EXECUTION ORDER

1. **Phase 1** - Infrastructure (foundation)
2. **Phase 2.1** - Bug #1 (error handling)
3. **Phase 2.2** - Bug #7 (rate limit)
4. **Phase 2.3** - Bug #3 (pagination)
5. **Phase 3.1** - Bug #2 (toast)
6. **Phase 3.2** - Bug #4 (validation)
7. **Phase 3.3** - Bug #6 (timezone)
8. **Phase 4.1** - Bug #5 (race condition)

---

## 📚 REFERENCES

- **Audit Report:** [`docs/FRONTEND_BUG_AUDIT_REPORT.md`](../docs/FRONTEND_BUG_AUDIT_REPORT.md)
- **Backend Validation:** `lib/validations/lembur.ts`
- **Middleware:** `lib/middleware/rate-limit.ts`
- **API Handler:** `lib/api/handler.ts`

---

**Created By:** Debug Mode Audit  
**Implementation By:** Code Mode  
**Estimated Timeline:** 8-15 hours  
**Target Completion:** 2-3 days
