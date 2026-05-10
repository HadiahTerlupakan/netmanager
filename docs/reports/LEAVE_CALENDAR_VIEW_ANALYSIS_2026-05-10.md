# Analisis & Implementasi Leave Calendar View (ISU #9)

**Tanggal:** 2026-05-10
**Status:** 📋 READY FOR IMPLEMENTATION
**Priority:** MEDIUM
**Estimated Effort:** 1-2 hari

---

## Executive Summary

ISU #9 adalah fitur untuk menambahkan **calendar view** untuk visualisasi leave schedule. Saat ini hanya ada table/list view di `/admin/kehadiran/izin`, tidak ada calendar visualization untuk melihat distribusi cuti karyawan.

**Impact:** MEDIUM - Meningkatkan planning & visibility untuk admin
**Complexity:** MEDIUM - Perlu calendar UI component dan data aggregation
**Breaking Changes:** ❌ NONE - Pure addition

---

## Problem Statement

### Kondisi Saat Ini

**Halaman Leave Management (`/admin/kehadiran/izin`):**
- ✅ Table view dengan filter status (PENDING, APPROVED, REJECTED)
- ✅ Detail per leave request
- ✅ Approval/rejection workflow
- ❌ **Tidak ada calendar view**
- ❌ **Tidak ada visualisasi distribusi cuti**
- ❌ **Sulit melihat konflik/overlap secara visual**

**Dampak:**
- Admin sulit melihat distribusi cuti dalam satu bulan
- Tidak bisa detect visual jika terlalu banyak orang cuti di tanggal sama
- Planning resource sulit karena tidak ada overview
- Harus scroll table untuk melihat semua leave requests

**Use Cases yang Tidak Terpenuhi:**
1. "Berapa orang yang cuti minggu depan?"
2. "Apakah ada hari dengan terlalu banyak orang cuti?"
3. "Siapa saja yang cuti bulan ini?"
4. "Kapan tim saya available semua?"

---

## Solution Design

### 1. Calendar View Options

**Option A: Integrate ke Existing Page (Recommended)**
- Tambahkan tab "Calendar View" di `/admin/kehadiran/izin`
- Toggle antara Table View dan Calendar View
- Reuse existing filters (status, department, site)

**Option B: Separate Page**
- Buat halaman baru `/admin/kehadiran/leave-calendar`
- Dedicated untuk calendar visualization
- Link dari existing izin page

**Recommendation:** **Option A** - Lebih cohesive, user tidak perlu pindah halaman.

### 2. Calendar Library Options

**Option 1: React Big Calendar (Recommended)**
```bash
npm install react-big-calendar date-fns
```
- ✅ Mature & well-maintained
- ✅ Flexible customization
- ✅ Good documentation
- ✅ Support month/week/day views
- ✅ Event rendering & styling
- ❌ Bundle size: ~100KB

**Option 2: FullCalendar**
```bash
npm install @fullcalendar/react @fullcalendar/daygrid
```
- ✅ Feature-rich
- ✅ Professional look
- ❌ Heavier bundle size: ~200KB
- ❌ Premium features require license

**Option 3: Custom Calendar (Not Recommended)**
- ✅ Lightweight
- ❌ High development effort
- ❌ Maintenance burden
- ❌ Reinventing the wheel

**Recommendation:** **React Big Calendar** - Best balance antara features dan bundle size.

### 3. Calendar Features

**Must Have:**
- ✅ Month view (default)
- ✅ Show approved leaves as events
- ✅ Color coding by leave type (CUTI, SAKIT, IZIN, TUKAR_LIBUR)
- ✅ Click event to see details
- ✅ Filter by department/site
- ✅ Navigate between months

**Nice to Have:**
- Week view
- Day view
- Show pending leaves (different style)
- Highlight conflicts (>X people on same day)
- Export calendar view
- Print calendar

**Out of Scope (Future):**
- Drag & drop to reschedule
- Create leave from calendar
- Multi-user selection

### 4. Data Structure

**Calendar Event Format:**
```typescript
interface CalendarEvent {
  id: string;
  title: string; // "John Doe - CUTI"
  start: Date;
  end: Date;
  resource: {
    leaveId: string;
    userId: string;
    userName: string;
    leaveType: LeaveType;
    status: LeaveStatus;
    department?: string;
    site?: string;
  };
}
```

**API Endpoint:**
```typescript
GET /api/admin/leaves/calendar?month=2026-05&departmentId=xxx&siteId=xxx
Response: {
  success: true,
  data: CalendarEvent[]
}
```

### 5. UI Design

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Leave Management                                         │
├─────────────────────────────────────────────────────────┤
│ [Table View] [Calendar View] ← Tabs                     │
├─────────────────────────────────────────────────────────┤
│ Filters: [Department ▼] [Site ▼] [Status ▼]            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ◀ May 2026 ▶                                           │
│  ┌────┬────┬────┬────┬────┬────┬────┐                  │
│  │Sun │Mon │Tue │Wed │Thu │Fri │Sat │                  │
│  ├────┼────┼────┼────┼────┼────┼────┤                  │
│  │    │    │    │ 1  │ 2  │ 3  │ 4  │                  │
│  │    │    │    │    │John│    │    │                  │
│  │    │    │    │    │CUTI│    │    │                  │
│  ├────┼────┼────┼────┼────┼────┼────┤                  │
│  │ 5  │ 6  │ 7  │ 8  │ 9  │ 10 │ 11 │                  │
│  │    │Jane│Jane│    │    │    │    │                  │
│  │    │SAKIT    │    │    │    │    │                  │
│  └────┴────┴────┴────┴────┴────┴────┘                  │
│                                                          │
│  Legend:                                                 │
│  🟦 CUTI  🟥 SAKIT  🟨 IZIN  🟩 TUKAR_LIBUR            │
└─────────────────────────────────────────────────────────┘
```

**Color Scheme:**
- CUTI (Annual Leave): Blue (#3B82F6)
- SAKIT (Sick Leave): Red (#EF4444)
- IZIN (Permission): Yellow (#F59E0B)
- TUKAR_LIBUR (Day Off Exchange): Green (#10B981)
- LAINNYA (Other): Gray (#6B7280)

**Event Styling:**
- Approved: Solid color
- Pending: Dashed border
- Rejected: Strikethrough (optional, might not show)

### 6. Conflict Detection

**Visual Indicator:**
- Jika >5 orang cuti di tanggal sama: Background merah muda
- Jika >3 orang cuti di tanggal sama: Background kuning muda
- Show count badge: "5 people"

**Implementation:**
```typescript
function getDateConflictLevel(date: Date, events: CalendarEvent[]): 'high' | 'medium' | 'none' {
  const count = events.filter(e => 
    isSameDay(e.start, date) || 
    (isAfter(date, e.start) && isBefore(date, e.end))
  ).length;
  
  if (count > 5) return 'high';
  if (count > 3) return 'medium';
  return 'none';
}
```

---

## Implementation Plan

### Phase 1: Setup & Basic Calendar (4-6 hours)

**Step 1.1: Install Dependencies**
```bash
npm install react-big-calendar date-fns
npm install --save-dev @types/react-big-calendar
```

**Step 1.2: Create Calendar Component**
```typescript
// app/admin/kehadiran/izin/LeaveCalendarView.tsx
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { id } from 'date-fns/locale';

const locales = { 'id': id };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export function LeaveCalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 600 }}
      culture="id"
    />
  );
}
```

**Step 1.3: Add Tab Toggle to IzinClient**
```typescript
// app/admin/kehadiran/izin/IzinClient.tsx
const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

return (
  <div>
    <div className="flex gap-2 mb-4">
      <Button 
        variant={viewMode === 'table' ? 'primary' : 'outline'}
        onClick={() => setViewMode('table')}
      >
        Table View
      </Button>
      <Button 
        variant={viewMode === 'calendar' ? 'primary' : 'outline'}
        onClick={() => setViewMode('calendar')}
      >
        Calendar View
      </Button>
    </div>
    
    {viewMode === 'table' ? (
      <ResponsiveTable ... />
    ) : (
      <LeaveCalendarView filters={filters} />
    )}
  </div>
);
```

### Phase 2: API Endpoint (2-3 hours)

**Step 2.1: Create Calendar Service**
```typescript
// modules/attendance/services/LeaveCalendarService.ts
export class LeaveCalendarService {
  async getCalendarEvents(input: {
    month: string; // "2026-05"
    departmentId?: string;
    siteId?: string;
    tenantId: string;
  }): Promise<CalendarEvent[]> {
    const [year, month] = input.month.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const leaves = await this.leaveRepository.findApprovedInRange(
      startDate,
      endDate,
      input.tenantId,
      input.departmentId,
      input.siteId,
    );
    
    return leaves.map(leave => ({
      id: leave.id,
      title: `${leave.user.name} - ${leave.type}`,
      start: new Date(leave.startDate),
      end: new Date(leave.endDate),
      resource: {
        leaveId: leave.id,
        userId: leave.userId,
        userName: leave.user.name,
        leaveType: leave.type,
        status: leave.status,
        department: leave.user.department?.name,
        site: leave.user.site?.name,
      },
    }));
  }
}
```

**Step 2.2: Create API Route**
```typescript
// app/api/admin/leaves/calendar/route.ts
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("leaves:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }
  
  const { searchParams } = req.nextUrl;
  const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
  const departmentId = searchParams.get("departmentId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  
  const service = new LeaveCalendarService();
  const events = await service.getCalendarEvents({
    month,
    departmentId,
    siteId,
    tenantId: ctx.session!.user.tenantId,
  });
  
  return apiSuccess(events);
});
```

**Step 2.3: Add Repository Method**
```typescript
// modules/attendance/repositories/LeaveRepository.ts
async findApprovedInRange(
  startDate: Date,
  endDate: Date,
  tenantId: string,
  departmentId?: string,
  siteId?: string,
) {
  return prisma.leave.findMany({
    where: {
      tenantId,
      status: "APPROVED",
      OR: [
        {
          startDate: { gte: startDate, lte: endDate },
        },
        {
          endDate: { gte: startDate, lte: endDate },
        },
        {
          AND: [
            { startDate: { lte: startDate } },
            { endDate: { gte: endDate } },
          ],
        },
      ],
      ...(departmentId && {
        user: { departmentId },
      }),
      ...(siteId && {
        user: { siteId },
      }),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          department: { select: { name: true } },
          site: { select: { name: true } },
        },
      },
    },
    orderBy: { startDate: "asc" },
  });
}
```

### Phase 3: Styling & UX (3-4 hours)

**Step 3.1: Custom Event Styling**
```typescript
const eventStyleGetter = (event: CalendarEvent) => {
  const colors = {
    CUTI: '#3B82F6',
    SAKIT: '#EF4444',
    IZIN: '#F59E0B',
    TUKAR_LIBUR: '#10B981',
    LAINNYA: '#6B7280',
  };
  
  return {
    style: {
      backgroundColor: colors[event.resource.leaveType] || colors.LAINNYA,
      borderRadius: '4px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
    },
  };
};

<Calendar
  eventPropGetter={eventStyleGetter}
  ...
/>
```

**Step 3.2: Event Click Handler**
```typescript
const handleSelectEvent = (event: CalendarEvent) => {
  setSelectedLeave(event.resource);
  setShowDetailModal(true);
};

<Calendar
  onSelectEvent={handleSelectEvent}
  ...
/>
```

**Step 3.3: Add Legend**
```typescript
<div className="flex gap-4 mt-4">
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 bg-blue-500 rounded" />
    <span>CUTI</span>
  </div>
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 bg-red-500 rounded" />
    <span>SAKIT</span>
  </div>
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 bg-yellow-500 rounded" />
    <span>IZIN</span>
  </div>
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 bg-green-500 rounded" />
    <span>TUKAR LIBUR</span>
  </div>
</div>
```

### Phase 4: Conflict Detection (2-3 hours)

**Step 4.1: Calculate Daily Counts**
```typescript
const getDailyLeaveCounts = (events: CalendarEvent[]) => {
  const counts = new Map<string, number>();
  
  events.forEach(event => {
    let current = new Date(event.start);
    const end = new Date(event.end);
    
    while (current <= end) {
      const key = format(current, 'yyyy-MM-dd');
      counts.set(key, (counts.get(key) || 0) + 1);
      current = addDays(current, 1);
    }
  });
  
  return counts;
};
```

**Step 4.2: Custom Day Cell Styling**
```typescript
const dayPropGetter = (date: Date) => {
  const key = format(date, 'yyyy-MM-dd');
  const count = dailyCounts.get(key) || 0;
  
  if (count > 5) {
    return {
      style: {
        backgroundColor: '#FEE2E2', // red-100
      },
    };
  }
  
  if (count > 3) {
    return {
      style: {
        backgroundColor: '#FEF3C7', // yellow-100
      },
    };
  }
  
  return {};
};

<Calendar
  dayPropGetter={dayPropGetter}
  ...
/>
```

**Step 4.3: Show Count Badge**
```typescript
const CustomDateHeader = ({ date, label }: { date: Date; label: string }) => {
  const key = format(date, 'yyyy-MM-dd');
  const count = dailyCounts.get(key) || 0;
  
  return (
    <div className="relative">
      <span>{label}</span>
      {count > 0 && (
        <span className="absolute top-0 right-0 bg-blue-500 text-white text-xs rounded-full px-1">
          {count}
        </span>
      )}
    </div>
  );
};

<Calendar
  components={{
    month: {
      dateHeader: CustomDateHeader,
    },
  }}
  ...
/>
```

### Phase 5: Testing (2-3 hours)

**Unit Tests:**
```typescript
// tests/modules/attendance/leave-calendar.test.ts
describe("LeaveCalendarService", () => {
  it("should return events for given month", async () => {
    const service = new LeaveCalendarService();
    const events = await service.getCalendarEvents({
      month: "2026-05",
      tenantId: "tenant-1",
    });
    
    expect(events).toBeInstanceOf(Array);
    expect(events[0]).toHaveProperty("title");
    expect(events[0]).toHaveProperty("start");
    expect(events[0]).toHaveProperty("end");
  });
  
  it("should filter by department", async () => {
    // Test department filtering
  });
  
  it("should handle multi-day leaves", async () => {
    // Test leave spanning multiple days
  });
});
```

**Integration Tests:**
```typescript
// tests/api/admin-leaves-calendar.test.ts
describe("GET /api/admin/leaves/calendar", () => {
  it("should return calendar events", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/leaves/calendar?month=2026-05")
    );
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
  });
  
  it("should require authentication", async () => {
    // Test auth requirement
  });
  
  it("should respect tenant isolation", async () => {
    // Test tenant filtering
  });
});
```

**Manual Testing Checklist:**
- [ ] Calendar renders correctly
- [ ] Events show with correct colors
- [ ] Click event shows details
- [ ] Navigate between months works
- [ ] Filter by department works
- [ ] Filter by site works
- [ ] Multi-day leaves span correctly
- [ ] Conflict highlighting works
- [ ] Legend displays correctly
- [ ] Mobile responsive
- [ ] Performance with 100+ events

---

## Performance Considerations

### Data Volume

**Scenario:** Tenant dengan 100 karyawan, rata-rata 2 hari cuti per bulan
- Events per month: ~200 events
- Data size: ~50KB JSON
- Render time: <100ms

**Optimization:**
- ✅ Only fetch approved leaves (reduce data)
- ✅ Limit to current month (pagination)
- ✅ Use React.memo for event components
- ✅ Debounce filter changes

### Bundle Size

**React Big Calendar:**
- Library: ~100KB gzipped
- date-fns: Already in project
- Total addition: ~100KB

**Mitigation:**
- Use code splitting: `const Calendar = lazy(() => import('./LeaveCalendarView'))`
- Only load when calendar tab is active

---

## Edge Cases

### 1. Multi-Day Leaves
**Problem:** Leave dari 5-10 Mei harus span 6 hari di calendar.
**Solution:** React Big Calendar handles this automatically dengan start/end dates.

### 2. Cross-Month Leaves
**Problem:** Leave dari 28 Mei - 3 Juni.
**Solution:** Query harus include leaves yang overlap dengan month range.

### 3. Empty Calendar
**Problem:** Tidak ada leave di bulan tertentu.
**Solution:** Show empty state dengan message "Tidak ada cuti di bulan ini".

### 4. Too Many Events in One Day
**Problem:** 10+ orang cuti di tanggal sama, event overlap.
**Solution:** 
- React Big Calendar akan stack events
- Show "+X more" indicator
- Click to expand

### 5. Timezone Issues
**Problem:** Date conversion bisa shift 1 hari.
**Solution:** 
- Store dates as YYYY-MM-DD string
- Parse dengan date-fns tanpa timezone conversion
- Use `startOfDay()` untuk consistency

---

## Rollback Plan

Jika ada issue setelah deployment:

**Option 1: Hide Calendar Tab**
```typescript
const ENABLE_CALENDAR_VIEW = process.env.NEXT_PUBLIC_ENABLE_CALENDAR === "true";

{ENABLE_CALENDAR_VIEW && (
  <Button onClick={() => setViewMode('calendar')}>
    Calendar View
  </Button>
)}
```

**Option 2: Revert Commit**
```bash
git revert <commit-hash>
```

---

## Files to Create/Modify

### New Files (5)
1. `app/admin/kehadiran/izin/LeaveCalendarView.tsx` - Calendar component
2. `app/api/admin/leaves/calendar/route.ts` - API endpoint
3. `modules/attendance/services/LeaveCalendarService.ts` - Business logic
4. `tests/modules/attendance/leave-calendar.test.ts` - Unit tests
5. `tests/api/admin-leaves-calendar.test.ts` - Integration tests

### Modified Files (2)
1. `app/admin/kehadiran/izin/IzinClient.tsx` - Add tab toggle
2. `modules/attendance/repositories/LeaveRepository.ts` - Add findApprovedInRange()

### Dependencies (2)
1. `react-big-calendar` - Calendar UI library
2. `@types/react-big-calendar` - TypeScript definitions

---

## Deployment Checklist

### Pre-Deployment
- [ ] Install dependencies
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Typecheck passing
- [ ] Lint passing
- [ ] Manual testing completed
- [ ] Performance tested with 100+ events
- [ ] Mobile responsive verified

### Post-Deployment Monitoring
- [ ] Monitor API response time (target < 200ms)
- [ ] Monitor bundle size impact
- [ ] Check error logs for calendar rendering issues
- [ ] Verify tenant isolation working
- [ ] Track user engagement (calendar vs table view usage)

### Metrics to Track
1. **Calendar View Usage:** % of users who use calendar view
2. **API Performance:** p95 response time for /calendar endpoint
3. **Error Rate:** Calendar rendering errors
4. **User Feedback:** Qualitative feedback from admins

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

**1. Week & Day Views**
- Add view switcher: Month / Week / Day
- Week view: Better for detailed planning
- Day view: See all leaves for specific date

**2. Export Calendar**
- Export to PDF
- Export to Excel
- Export to iCal (import to Google Calendar)

**3. Advanced Filters**
- Filter by leave type
- Filter by user
- Search by name
- Date range picker

**4. Statistics Panel**
- Total leaves this month
- Most common leave type
- Department with most leaves
- Trend chart

**5. Drag & Drop Reschedule**
- Drag event to new date
- Requires approval workflow
- Conflict detection on drop

**6. Create Leave from Calendar**
- Click empty date to create leave
- Quick create modal
- Pre-fill dates from selection

---

## Related Issues

### Dependencies
- ✅ ISU #10: Overlap Detection (COMPLETED) - Prevents double booking
- ✅ ISU #4: workDays Validation (COMPLETED) - Ensures correct working days calculation

### Synergies
- ISU #7: Auto-Approval Rules - Calendar can show auto-approved vs manual
- ISU #2: Bulk Import Holiday - Holidays can be shown on calendar too
- ISU #12: Leave History Export - Export can include calendar view

---

## Conclusion

ISU #9 (Leave Calendar View) adalah **medium-priority feature** dengan **high user value**:

**Pros:**
- ✅ Significantly improves leave planning visibility
- ✅ Easy to spot conflicts visually
- ✅ Better UX for admins
- ✅ Mature library available (React Big Calendar)
- ✅ No breaking changes
- ✅ Reasonable effort (1-2 hari)

**Cons:**
- ⚠️ Adds ~100KB to bundle size
- ⚠️ Requires new API endpoint
- ⚠️ Need to handle edge cases (multi-day, cross-month)

**Recommendation:** **PROCEED WITH IMPLEMENTATION**

Estimated timeline:
- Phase 1 (Basic Calendar): 4-6 hours
- Phase 2 (API): 2-3 hours
- Phase 3 (Styling): 3-4 hours
- Phase 4 (Conflict Detection): 2-3 hours
- Phase 5 (Testing): 2-3 hours
- **Total: 13-19 hours (~1.5-2 hari)**

---

**End of Analysis Report**
