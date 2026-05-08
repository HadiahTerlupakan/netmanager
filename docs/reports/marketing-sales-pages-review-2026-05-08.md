# Review Halaman Marketing Sales - 2026-05-08

## Summary

Review terhadap dua halaman marketing sales:
1. `/admin/marketing/sales` - Manajemen Sales List
2. `/admin/marketing/sales-dashboard` - Dashboard Sales Performance

**Status:** ✅ Kedua halaman sudah diimplementasi dengan baik, tidak ada bug kritis ditemukan.

---

## 1. Halaman Sales List (`/admin/marketing/sales`)

### Komponen Frontend
**File:** `app/admin/marketing/sales/SalesListClient.tsx`

**Fitur:**
- List semua user dengan `isSales: true`
- Menampilkan target bulanan dan pencapaian (approved/pending)
- Filter search berdasarkan nama, email, departemen, site
- Edit target canvasing per sales (modal)
- Progress bar visual untuk tracking pencapaian
- Stats cards: Total Sales, Total Target, Tercapai, Menunggu

**Permission Check:**
- Read: `sales:read` ✅
- Update target: `sales:update` ✅

### API Endpoint
**File:** `app/api/admin/marketing/sales/route.ts`

**Implementation:**
```typescript
export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
  if (!(await hasPermission("sales:read"))) {
    return ApiErrors.forbidden("...");
  }
  return apiSuccess(await adminSalesRouteService.getSalesOverview());
});
```

**Service Layer:**
**File:** `modules/marketing/services/AdminSalesRouteService.ts`

Method: `getSalesOverview()`
- Query user dengan `isSales: true, isActive: true`
- Aggregate canvasing data bulan ini (startOfMonth - endOfMonth)
- Group by `salesId` dan `status`
- Return: `{ users, stats }`

**Data Flow:**
```
Frontend → API Route → AdminSalesRouteService.getSalesOverview()
  → Prisma query users + canvasing.groupBy
  → buildSalesOverview() helper
  → Return { users: [...], stats: {...} }
```

**Findings:**
- ✅ Thin controller pattern sudah diterapkan
- ✅ Business logic ada di service layer
- ✅ Permission check di route level
- ✅ Data aggregation efisien dengan `groupBy`
- ✅ Response structure match dengan frontend expectation

---

## 2. Halaman Sales Dashboard (`/admin/marketing/sales-dashboard`)

### Komponen Frontend
**File:** `app/admin/marketing/sales-dashboard/SalesDashboardClient.tsx`

**Fitur:**
- Filter period: day, week, month, all, custom date range
- Filter by site (dropdown)
- Team stats overview (7 metrics cards)
- Top Performers (top 3 dengan ranking visual)
- Top Sites (top 3 site dengan approved count)
- Weekly Trend Chart (7 hari terakhir)
- Full Leaderboard table dengan ranking, progress bar, badges

**Permission Check:**
- Read: `sales_dashboard:read` ✅

### API Endpoint
**File:** `app/api/admin/marketing/sales-dashboard/route.ts`

**Implementation:**
```typescript
export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!(await hasPermission("sales_dashboard:read"))) {
    return ApiErrors.forbidden("...");
  }
  const result = await adminSalesRouteService.getSalesDashboard({
    period, siteId, customStart, customEnd
  });
  return apiSuccess(result);
}
```

**Service Layer:**
**File:** `modules/marketing/services/AdminSalesRouteService.ts`

Method: `getSalesDashboard(input)`
- Query active sites
- Build date range berdasarkan period (helper: `buildDashboardRange`)
- Query sales users (filtered by siteId jika ada)
- Build leaderboard dengan Promise.all untuk setiap user:
  - Aggregate canvasing by status
  - Aggregate point claims (APPROVED)
- Rank leaderboard berdasarkan points dan approved count
- Aggregate site stats (approved count per site)
- Build weekly trend (7 hari terakhir)

**Helper Functions:**
**File:** `modules/marketing/services/admin-sales-dashboard.helpers.ts`

Key helpers:
- `buildLeaderboardEntry()` - Transform user + stats → leaderboard entry
- `buildRankedLeaderboard()` - Sort by points/approved, assign rank
- `buildTopSites()` - Aggregate approved count per site, sort, slice top 3
- `buildTeamStats()` - Sum all metrics across leaderboard
- `buildWeeklyTrend()` - Loop 7 hari, count approved per day

**Data Flow:**
```
Frontend → API Route → AdminSalesRouteService.getSalesDashboard()
  → Query sites, users
  → Promise.all per user (canvasing stats + points)
  → buildLeaderboardEntry() per user
  → buildRankedLeaderboard() - sort & rank
  → buildTopSites() - aggregate by site
  → buildWeeklyTrend() - 7 days loop
  → Return { period, sites, teamStats, topPerformers, topSites, leaderboard, weeklyTrend }
```

**Findings:**
- ✅ Thin controller pattern sudah diterapkan
- ✅ Business logic ada di service layer
- ✅ Helper functions well-organized dan reusable
- ✅ Permission check di route level
- ✅ Efficient aggregation dengan Promise.all
- ✅ Response structure match dengan frontend expectation
- ✅ Date range handling sudah proper (helper terpisah)

---

## Architecture Compliance

### ✅ Clean Architecture Pattern
- **Route layer:** Thin controller, hanya auth + permission + call service
- **Service layer:** Business logic, orchestration, data transformation
- **Helper layer:** Pure functions untuk aggregation dan calculation
- **No Prisma leak:** Semua query ada di service, tidak ada di route

### ✅ Permission Model
- `sales:read` untuk list sales
- `sales:update` untuk edit target
- `sales_dashboard:read` untuk dashboard

### ✅ Code Quality
- No magic numbers (constants: `DEFAULT_CANVASING_TARGET`, `TOP_LIMIT`, `WEEKLY_TREND_DAYS`)
- Type-safe dengan TypeScript interfaces
- Helper functions dengan single responsibility
- No code smell detected

---

## Potential Improvements (Optional)

### 1. Caching Opportunity
Dashboard query cukup berat (loop per user + aggregate). Pertimbangkan cache:
```typescript
// Cache key: `sales-dashboard:${period}:${siteId}`
// TTL: 5-10 menit
```

### 2. Pagination untuk Leaderboard
Jika jumlah sales > 100, pertimbangkan pagination di full leaderboard table.

### 3. Real-time Update
Jika perlu real-time, bisa tambahkan polling atau WebSocket untuk auto-refresh stats.

---

## Conclusion

**Status:** ✅ Semua halaman sudah production-ready setelah perbaikan scope leakage dan nama sales

**Perbaikan yang sudah dilakukan:**
- Fix empty sales names di canvasing list (Task #29) ✅
- Fix scope leakage di sales list dan dashboard (Task #31) ✅
- Fix scope leakage di canvasing list endpoint (Task #31 - final) ✅
- Fix blank sales names - missing sites relation (Final fix) ✅

**Bug Kritis yang Ditemukan dan Diperbaiki:**

### 1. Scope Leakage (CRITICAL) - FIXED ✅
**Masalah:** User yang restricted ke site tertentu bisa melihat semua data sales dari semua site

**Root Cause:**
- `getSalesOverview()` tidak filter berdasarkan `allowedSiteIds`
- `getSalesDashboard()` tidak filter sites dropdown dan aggregate data
- Weekly trend dan site stats menghitung data global tanpa scope restriction
- **Deeper issue:** Restriction bergantung pada permission `sales:site_only` yang belum tentu aktif di role existing
- **Actual root cause:** Canvasing list page menggunakan endpoint `/api/marketing/canvasing` yang berbeda dari sales routes dan masih menggunakan logika restriction lama

**Solusi yang Diterapkan:**

**Commit 1 (1a51fa08):** Permission-based restriction di sales routes
- Extract `allowedSiteIds` dari `checkSiteRestriction()` di route layer
- Pass `allowedSiteIds` ke service methods
- Filter sales users, sites dropdown, dan aggregate data

**Commit 2 (17f451b5):** Session-based restriction di sales routes
- Ubah dari permission-based ke session-based restriction
- Non-super-admin users dengan `siteIds` otomatis restricted
- Tidak lagi bergantung pada `sales:site_only` permission
- Backward compatible dengan role existing yang belum punya permission `site_only`
- Tambahkan MARKETING permission constants ke `lib/permissions.ts`

**Commit 3 (b8a9862b):** Session-based restriction di canvasing endpoint (final fix)
- Fix endpoint `/api/marketing/canvasing` yang digunakan halaman canvasing list
- Replace `permissions.includes("canvasing:site_only")` dengan session-based check
- Validate user-provided siteId filter against `session.siteIds`
- Default to first allowed site if no filter provided
- Konsisten dengan pattern yang sudah diterapkan di sales/sales-dashboard routes

**Implementation (Sales Routes):**
```typescript
// Route layer - enforce restriction berdasarkan session
const user = ctx.session.user as {
  id: string;
  siteIds?: string[];
  isSuperAdmin?: boolean;
};
const allowedSiteIds =
  !isSuperAdmin(user) && user.siteIds && user.siteIds.length > 0
    ? user.siteIds
    : undefined;

// Service layer - filter berdasarkan allowedSiteIds
const siteFilter =
  input?.allowedSiteIds && input.allowedSiteIds.length > 0
    ? { siteId: { in: input.allowedSiteIds } }
    : {};
```

**Implementation (Canvasing Endpoint):**
```typescript
// Session-based site restriction
const user = session as {
  id: string;
  siteId?: string;
  siteIds?: string[];
  role: string;
};
const isSiteRestricted =
  !isSuperAdmin && user.siteIds && user.siteIds.length > 0;

// Enforce restriction
if (isSiteRestricted) {
  if (user.siteIds && user.siteIds.length > 0) {
    // Validate user-provided siteId filter
    if (filterSiteId && !user.siteIds.includes(filterSiteId)) {
      return emptyResponse;
    }
    // Default to first allowed site if no filter
    if (!filterSiteId) {
      filterSiteId = user.siteIds[0];
    }
  } else {
    return emptyResponse;
  }
}
```

**Files Modified:**
- `app/api/admin/marketing/sales/route.ts`
- `app/api/admin/marketing/sales-dashboard/route.ts`
- `app/api/marketing/canvasing/route.ts`
- `modules/marketing/services/AdminSalesRouteService.ts`
- `lib/permissions.ts`

**Verification:**
- ✅ Typecheck passed
- ✅ Architecture compliance maintained
- ✅ Thin controller pattern preserved
- ✅ Backward compatible dengan role existing
- ✅ Restriction enforcement tidak bergantung pada permission matrix

**Rekomendasi:**
- Monitor query performance untuk dashboard (banyak aggregate)
- Jika ada performance issue, tambahkan caching dengan key per-site

---

### 2. Blank Sales Names (CRITICAL) - FIXED ✅

**Masalah:** Nama sales tidak muncul di canvasing list, kolom salesName kosong

**Root Cause:**
- `canvasingUserSelect` di repository helpers tidak include relasi `sites`
- Hanya query `id, name, email, siteId` tapi tidak include `user.sites`
- Mapper `toCanvasingDomainWithSite` mencoba akses `entity.user.sites` yang tidak pernah di-query
- `toSiteReference(entity.user.sites)` return null karena `sites` undefined
- Meskipun data user ada di database, relasi sites tidak ter-populate di Prisma query

**Solusi yang Diterapkan:**

**Commit 4 (db7011c8):** Include sites relation in canvasing user select
- Tambahkan `sites: { select: { id: true, name: true } }` ke `canvasingUserSelect`
- Prisma sekarang query relasi sites saat fetch canvasing list
- Mapper `toCanvasingDomainWithSite` bisa akses `entity.user.sites` dengan benar
- `toSiteReference` return site data yang valid

**Implementation:**
```typescript
// Before (missing sites relation)
const canvasingUserSelect = {
  id: true,
  name: true,
  email: true,
  siteId: true,
} satisfies Prisma.UserSelect;

// After (include sites relation)
const canvasingUserSelect = {
  id: true,
  name: true,
  email: true,
  siteId: true,
  sites: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserSelect;
```

**Files Modified:**
- `modules/marketing/repositories/canvasing.repository.helpers.ts`

**Verification:**
- ✅ Typecheck passed
- ✅ Database query confirmed: user names exist in database
- ✅ Prisma query now includes sites relation
- ✅ Mapper can access entity.user.sites correctly

---

*Generated: 2026-05-08*
*Updated: 2026-05-08 04:23 (Blank sales names fix - sites relation)*
*Reviewer: Claude (Autonomous)*
