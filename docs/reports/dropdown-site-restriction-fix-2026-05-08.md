# Fix Dropdown Site Restriction - Data Leak Prevention

**Date:** 2026-05-08  
**Issue:** Dropdown "Semua Site" menampilkan semua site meskipun user memiliki permission `{resource}:site_only`  
**Severity:** HIGH - Data leakage  
**Status:** FIXED

---

## Root Cause Analysis

### Masalah Utama

User dengan permission `{resource}:site_only` yang **belum di-assign ke site manapun** tetap bisa melihat semua site di dropdown filter.

### Technical Root Cause

**File:** `modules/roles/services/AdminOptionsRouteService.ts:41-44`

```typescript
// ❌ LOGIC SALAH
const filteredSites =
  allowedSiteIds && allowedSiteIds.length > 0
    ? sites.filter((site) => allowedSiteIds.includes(site.id))
    : sites;
```

**Skenario Bug:**

1. User restricted punya permission `attendance:site_only`
2. User belum di-assign ke site manapun
3. `checkSiteRestriction()` return `{ isRestricted: true, siteIds: [] }`
4. Route pass `allowedSiteIds = []` ke service
5. Kondisi `allowedSiteIds.length > 0` = **false**
6. Fallback ke `sites` → **menampilkan SEMUA site** ❌

### Expected Behavior

Jika user restricted tapi tidak punya site access (`siteIds = []`), seharusnya return **array kosong**, bukan fallback ke semua site.

---

## Solution

### Fix 1: Early Return di Route Layer

**File:** `app/api/admin/options/route.ts`

```typescript
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const resource = new URL(req.url).searchParams.get("resource") || "users";
  const { isRestricted, siteIds } = checkSiteRestriction(
    ctx.session as never,
    resource,
  );

  // ✅ Jika restricted tapi tidak punya site access, return empty options
  if (isRestricted && siteIds.length === 0) {
    return apiSuccess({ sites: [], departments: [] });
  }

  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const options = await adminOptionsRouteService.getOptions(allowedSiteIds);
  return apiSuccess(options);
});
```

### Fix 2: Perbaiki Filter Logic di Service Layer

**File:** `modules/roles/services/AdminOptionsRouteService.ts`

```typescript
// ✅ LOGIC BENAR
// allowedSiteIds === undefined → tidak restricted, tampilkan semua
// allowedSiteIds === [] → restricted tapi tidak punya akses, return kosong
// allowedSiteIds === [id1, id2] → restricted, filter sesuai akses
const filteredSites =
  allowedSiteIds !== undefined
    ? sites.filter((site) => allowedSiteIds.includes(site.id))
    : sites;
```

**Penjelasan:**
- `allowedSiteIds !== undefined` → cek apakah user restricted
- Jika `undefined` → user tidak restricted, tampilkan semua site
- Jika `[]` → user restricted tapi tidak punya akses, filter akan return array kosong
- Jika `[id1, id2]` → user restricted dengan akses, filter sesuai ID

---

## Impact Analysis

### Fitur yang Terpengaruh

Semua fitur yang menggunakan dropdown site filter via `/api/admin/options`:

1. **Attendance (Kehadiran)**
   - File: `app/admin/attendance/AttendanceClient.tsx:126`
   - Parameter: `?resource=attendance`

2. **Leave (Izin/Cuti)**
   - File: `app/admin/izin/IzinClient.tsx`
   - Parameter: `?resource=izin`

3. **Overtime (Lembur)**
   - File: `app/admin/lembur/LemburClient.tsx:131`
   - Parameter: `?resource=lembur`

4. **Reports (Laporan Kehadiran)**
   - File: `app/admin/kehadiran/laporan/ReportClient.tsx:208`
   - Parameter: `?resource=attendance`

5. **Canvasing**
   - File: `app/admin/marketing/canvasing/CanvasingListHeader.tsx`
   - Component: `<SiteFilter resource="canvasing" />`

### Data Leak Scenario

**Before Fix:**
```
User: Teknisi Site A (permission: attendance:site_only, assigned sites: [])
Dropdown: [Site A, Site B, Site C, Site D] ❌ BOCOR
```

**After Fix:**
```
User: Teknisi Site A (permission: attendance:site_only, assigned sites: [])
Dropdown: [] ✅ AMAN (tidak ada site yang bisa diakses)

User: Teknisi Site A (permission: attendance:site_only, assigned sites: [Site A])
Dropdown: [Site A] ✅ AMAN (hanya site yang di-assign)

User: Admin (tidak ada permission attendance:site_only)
Dropdown: [Site A, Site B, Site C, Site D] ✅ AMAN (admin bisa lihat semua)
```

---

## Verification Steps

### 1. Setup Test User

```sql
-- User dengan permission site_only tapi belum di-assign site
UPDATE users SET siteId = NULL WHERE email = 'test@example.com';

-- Pastikan role punya permission attendance:site_only
SELECT p.resource, p.action 
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permissionId
JOIN roles r ON r.id = rp.roleId
WHERE r.name = 'Teknisi' AND p.resource = 'attendance' AND p.action = 'site_only';
```

### 2. Test Dropdown

1. Login sebagai user restricted tanpa site assignment
2. Buka halaman Attendance
3. Klik dropdown "Semua Site"
4. **Expected:** Dropdown kosong atau tidak muncul
5. **Before Fix:** Dropdown menampilkan semua site ❌
6. **After Fix:** Dropdown kosong ✅

### 3. Test dengan Site Assignment

```sql
-- Assign user ke Site A
INSERT INTO user_sites (userId, siteId, isPrimary) 
VALUES ('user-id', 'site-a-id', true);
```

1. Refresh browser (hard refresh: Cmd+Shift+R)
2. Logout dan login ulang
3. Buka halaman Attendance
4. Klik dropdown "Semua Site"
5. **Expected:** Hanya Site A yang muncul ✅

---

## Related Commits

1. **4d74504a** - fix canvasing site filter (added `resource="canvasing"`)
2. **b7ec17e1** - fix attendance site filter (added `?resource=attendance`)
3. **497eaccd** - fix report & overtime site filter (added resource params)
4. **3db69075** - fix dropdown site restriction logic (this fix)

---

## Prevention Measures

### Code Review Checklist

Saat menambahkan dropdown site filter baru:

- [ ] Pastikan endpoint `/api/admin/options` dipanggil dengan parameter `?resource=<nama_resource>`
- [ ] Atau gunakan `<SiteFilter resource="<nama_resource>" />` component
- [ ] Pastikan permission `{resource}:site_only` sudah terdaftar di database
- [ ] Test dengan user yang:
  - Tidak restricted (admin) → harus lihat semua site
  - Restricted dengan site assignment → hanya lihat site yang di-assign
  - Restricted tanpa site assignment → tidak lihat site apapun

### Architecture Rule

**NEVER** fallback ke "tampilkan semua" ketika user restricted tapi tidak punya akses.

```typescript
// ❌ SALAH - Fallback ke semua data
if (allowedIds && allowedIds.length > 0) {
  return filterByIds(allowedIds);
}
return allData; // BAHAYA!

// ✅ BENAR - Explicit handling untuk setiap case
if (allowedIds === undefined) {
  return allData; // User tidak restricted
}
if (allowedIds.length === 0) {
  return []; // User restricted tapi tidak punya akses
}
return filterByIds(allowedIds); // User restricted dengan akses
```

---

## Testing

### Unit Test (TODO)

```typescript
describe('AdminOptionsRouteService', () => {
  it('should return empty sites when restricted user has no site access', async () => {
    const service = new AdminOptionsRouteService();
    const result = await service.getOptions([]);
    
    expect(result.sites).toEqual([]);
  });

  it('should return filtered sites when restricted user has site access', async () => {
    const service = new AdminOptionsRouteService();
    const result = await service.getOptions(['site-a-id']);
    
    expect(result.sites).toHaveLength(1);
    expect(result.sites[0].id).toBe('site-a-id');
  });

  it('should return all sites when user is not restricted', async () => {
    const service = new AdminOptionsRouteService();
    const result = await service.getOptions(undefined);
    
    expect(result.sites.length).toBeGreaterThan(1);
  });
});
```

### Integration Test (TODO)

```typescript
describe('GET /api/admin/options', () => {
  it('should return empty options for restricted user without site access', async () => {
    const session = createMockSession({
      permissions: ['attendance:site_only'],
      siteIds: [],
    });

    const response = await GET(
      new Request('http://localhost/api/admin/options?resource=attendance'),
      { session }
    );

    const data = await response.json();
    expect(data.sites).toEqual([]);
  });
});
```

---

## Conclusion

✅ **Root cause identified:** Incorrect fallback logic di `AdminOptionsRouteService`  
✅ **Fix applied:** Early return + proper undefined check  
✅ **Impact:** Prevents data leak untuk semua fitur dengan dropdown site filter  
✅ **Prevention:** Architecture rule + code review checklist

**Next Steps:**
1. Deploy ke production
2. Monitor logs untuk verify fix
3. Add unit + integration tests
4. Audit fitur lain yang mungkin punya pattern serupa

---

**Audit by:** Claude (AI Assistant)  
**Reviewed by:** User  
**Commit:** 3db69075
