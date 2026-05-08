# Audit Site Restriction Modul Kehadiran - 2026-05-08

## Ringkasan Eksekutif

Audit dilakukan untuk memastikan semua fitur kehadiran menerapkan site restriction dengan benar, mencegah kebocoran data di mana user restricted bisa melihat data site lain.

## Temuan

### ✅ Query Data Sudah Benar

**Fitur yang sudah menerapkan site restriction pada query data:**

1. **Attendance (Absensi)**
   - File: `modules/attendance/services/AdminAttendanceFilterService.ts:103-104`
   - Implementasi: `permissions.includes("attendance:site_only")` → filter `user.siteId`
   - Status: ✅ **AMAN** - Query data sudah restricted

2. **Leave (Izin/Cuti)**
   - File: `modules/attendance/services/AdminLeaveRouteService.ts:196-207`
   - Implementasi: `permissions.includes("izin:site_only")` → filter `siteId`
   - Status: ✅ **AMAN** - Query data sudah restricted

3. **Shift**
   - File: `app/api/admin/shifts/route.ts`
   - Status: ✅ **TIDAK PERLU** - Shift adalah data global per tenant, bukan per site

4. **Holidays (Hari Libur)**
   - File: `app/api/admin/holidays/route.ts`
   - Status: ✅ **TIDAK PERLU** - Holidays adalah data global per tenant, bukan per site

### ⚠️ Dropdown Filter Bermasalah (SUDAH DIPERBAIKI)

**Masalah yang ditemukan:**

1. **AttendanceClient - Dropdown Site Filter**
   - **Masalah:** Memanggil `/api/admin/options` tanpa parameter `resource`
   - **Dampak:** Dropdown menampilkan semua site, bukan hanya site yang boleh diakses user
   - **Root Cause:** Endpoint `/api/admin/options` hardcode resource `"users"` di line 11
   - **Perbaikan:** 
     - Update endpoint untuk terima parameter `resource` (default: `"users"`)
     - Update `AttendanceClient.tsx:126` menjadi `/api/admin/options?resource=attendance`
   - **Commit:** `b7ec17e1`

2. **CanvasingList - Dropdown Site Filter**
   - **Masalah:** `SiteFilter` tidak mengirim parameter `resource`
   - **Dampak:** Dropdown menampilkan semua site
   - **Perbaikan:** Tambah `resource="canvasing"` pada `SiteFilter`
   - **Commit:** `4d74504a`

### ✅ Fitur Lain Tidak Bermasalah

**Fitur yang tidak punya dropdown site filter:**

1. **IzinClient** - Tidak ada dropdown site filter
2. **ShiftClient** - Tidak ada dropdown site filter (shift adalah global)
3. **HolidayClient** - Tidak ada dropdown site filter (holidays adalah global)

## Detail Perbaikan

### 1. Endpoint `/api/admin/options`

**Before:**
```typescript
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const { isRestricted, siteIds } = checkSiteRestriction(
    ctx.session as never,
    "users", // ❌ Hardcoded
  );
  // ...
});
```

**After:**
```typescript
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const resource = new URL(req.url).searchParams.get("resource") || "users";
  const { isRestricted, siteIds } = checkSiteRestriction(
    ctx.session as never,
    resource, // ✅ Dynamic
  );
  // ...
});
```

### 2. AttendanceClient

**Before:**
```typescript
const response = await fetchWithHandling<{
  sites: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}>("/api/admin/options"); // ❌ Tanpa resource
```

**After:**
```typescript
const response = await fetchWithHandling<{
  sites: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}>("/api/admin/options?resource=attendance"); // ✅ Dengan resource
```

### 3. CanvasingListHeader

**Before:**
```typescript
<SiteFilter onSiteChange={onSiteChange} /> // ❌ Tanpa resource
```

**After:**
```typescript
<SiteFilter onSiteChange={onSiteChange} resource="canvasing" /> // ✅ Dengan resource
```

## Cara Kerja Site Restriction

### Flow Permission Check

```
User Login
    ↓
Session memuat role & permissions
    ↓
Frontend: usePermission() → hasPermission("attendance:read")
    ↓
Backend Route: checkSiteRestriction(session, "attendance")
    ↓
Cek permission "attendance:site_only"?
    ↓
YES → Filter query: user.siteId = currentUser.siteId
NO  → Tampilkan semua data (sesuai tenant)
```

### Komponen Kunci

1. **`checkSiteRestriction(session, resource)`**
   - File: `modules/roles/helpers/checkSiteRestriction.ts`
   - Fungsi: Cek apakah user punya permission `{resource}:site_only`
   - Return: `{ isRestricted: boolean, siteIds: string[] }`

2. **`SiteAccessRouteService.getAccessibleSites(user, resource)`**
   - File: `modules/roles/services/SiteAccessRouteService.ts`
   - Fungsi: Ambil daftar site yang boleh diakses user
   - Logic: Jika `resource` tidak dikirim, fallback ke `role.isRestricted`

3. **Permission Naming Convention**
   - Format: `{resource}:site_only`
   - Contoh: `attendance:site_only`, `canvasing:site_only`, `izin:site_only`

## Rekomendasi

### 1. Standarisasi Dropdown Site Filter

Untuk semua halaman yang punya dropdown site filter, pastikan:

```typescript
// ✅ BENAR - Kirim resource parameter
<SiteFilter onSiteChange={onSiteChange} resource="nama_resource" />

// ❌ SALAH - Tanpa resource
<SiteFilter onSiteChange={onSiteChange} />
```

### 2. Standarisasi Endpoint Options

Untuk endpoint yang mengembalikan dropdown options, pastikan:

```typescript
// ✅ BENAR - Terima resource parameter
const resource = new URL(req.url).searchParams.get("resource") || "default";
const { isRestricted, siteIds } = checkSiteRestriction(session, resource);

// ❌ SALAH - Hardcode resource
const { isRestricted, siteIds } = checkSiteRestriction(session, "users");
```

### 3. Checklist untuk Fitur Baru

Saat membuat fitur baru dengan site restriction:

- [ ] Tambahkan permission `{resource}:site_only` di database
- [ ] Query data: gunakan `checkSiteRestriction(session, resource)` di backend
- [ ] Dropdown filter: gunakan `<SiteFilter resource="nama_resource" />`
- [ ] Test dengan user restricted: pastikan hanya melihat data site sendiri

## Kesimpulan

✅ **Query data sudah aman** - Attendance dan Leave sudah menerapkan site restriction dengan benar

✅ **Dropdown filter sudah diperbaiki** - AttendanceClient dan CanvasingList sudah mengirim parameter `resource`

✅ **Endpoint sudah dinamis** - `/api/admin/options` sekarang menerima parameter `resource`

⚠️ **Perlu audit lanjutan** - Cek fitur lain yang mungkin punya dropdown site filter (marketing/sales, finance, inventory, dll)

---

**Audit oleh:** Claude (AI Assistant)  
**Tanggal:** 2026-05-08  
**Commit perbaikan:**
- `4d74504a` - fix canvasing site filter
- `b7ec17e1` - fix attendance site filter
