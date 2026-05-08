# Penjelasan Logika Halaman Canvasing

**URL:** `http://localhost:3000/admin/marketing/canvasing`

**Tujuan:** Halaman untuk mengelola dan memverifikasi request instalasi dari sales/mitra di lapangan.

---

## 1. Arsitektur Halaman

### Struktur Komponen

```
Page (Server Component)
  ↓ [Permission Check: canvasing:read OR canvasing:verify]
CanvasingList (Client Component)
  ↓ [useCanvasingPageState - Orchestrator]
  ├─ useCanvasingListQuery (Data Fetching)
  ├─ useCanvasingPermissions (RBAC)
  ├─ useCanvasingRowActions (Delete, Cancel Approval)
  └─ useCanvasingClaimReview (Approve/Reject Point Claims)
  ↓
CanvasingListContent (Presentation)
  ├─ CanvasingListHeader (Search, Site Filter, Create Button)
  ├─ CanvasingSummaryCards (Total, Pending, Approved, Rejected, Claims)
  ├─ CanvasingStatusFilters (ALL, PENDING, APPROVED, REJECTED)
  ├─ CanvasingTable (Data Grid + Pagination)
  └─ CanvasingListModals (Claim Review, Confirmation, Zoom Image)
```

---

## 2. Flow Data End-to-End

### A. Initial Load

```
1. User akses /admin/marketing/canvasing
   ↓
2. Server Component: ensureAnyPermission(["canvasing:read", "canvasing:verify"])
   ↓ [Jika tidak punya permission → redirect/error]
3. Render <CanvasingList /> (Client Component)
   ↓
4. useCanvasingPageState() dipanggil
   ↓
5. useCanvasingListQuery() → useEffect trigger fetchData()
   ↓
6. fetch("/api/marketing/canvasing?page=1&limit=10")
   ↓
7. API Route: GET /api/marketing/canvasing
   ├─ verifyAuth() → cek session
   ├─ getUserPermissions() → load RBAC
   ├─ Session-based site restriction:
   │   - Jika non-super-admin dengan siteIds → filter by siteIds
   │   - Jika super-admin → no filter (lihat semua)
   ├─ createCanvasingService().getAllRequests(filters, page, limit)
   │   ↓
   │   CanvasingRepository.findAll()
   │   ├─ Prisma query dengan include: user, workOrder, pointClaims
   │   ├─ Include user.sites untuk populate nama sales
   │   ├─ Filter: status, salesId, siteId, search
   │   ├─ Pagination: skip, take
   │   └─ buildCanvasingSummary() → aggregate counts
   │   ↓
   │   Map ke CanvasingEntity dengan toCanvasingDomainWithSite()
   │   ├─ Populate user.name dari entity.user
   │   ├─ Populate mitra.name dari mitraLookup (jika mitraId ada)
   │   └─ Fallback: salesName = user?.name ?? mitra?.name ?? null
   │   ↓
   │   Map ke DTO dengan toCanvasingListItemDTO()
   └─ Return { data, total, page, limit, summary }
   ↓
8. Frontend: setItems(json.data), setSummary(json.summary), setTotalPages()
   ↓
9. Render CanvasingListContent dengan data
```

### B. User Interaction: Search

```
1. User ketik di search box
   ↓
2. handleSearchChange(event) → updateSearch(value)
   ↓
3. setPage(1) + setSearch(value)
   ↓
4. useEffect dependency [search] trigger → fetchData()
   ↓
5. fetch("/api/marketing/canvasing?search=<value>&page=1&limit=10")
   ↓
6. API filter by search (nama, noTelpon, alamat, paket)
   ↓
7. Return filtered results
   ↓
8. UI update dengan data baru
```

### C. User Interaction: Filter by Status

```
1. User klik status filter (PENDING, APPROVED, REJECTED)
   ↓
2. updateStatusFilter(value)
   ↓
3. setPage(1) + setStatusFilter(value)
   ↓
4. useEffect dependency [statusFilter] trigger → fetchData()
   ↓
5. fetch("/api/marketing/canvasing?status=<value>&page=1&limit=10")
   ↓
6. API filter by status
   ↓
7. Return filtered results
```

### D. User Interaction: Filter by Site

```
1. User pilih site di dropdown
   ↓
2. updateSiteId(siteId)
   ↓
3. setPage(1) + setSiteId(siteId)
   ↓
4. useEffect dependency [siteId] trigger → fetchData()
   ↓
5. fetch("/api/marketing/canvasing?siteId=<value>&page=1&limit=10")
   ↓
6. API filter by siteId
   ↓ [Session-based restriction tetap enforce]
7. Return filtered results
```

### E. User Interaction: Delete Canvasing

```
1. User klik tombol Delete di row
   ↓
2. handleDelete(id, name)
   ↓
3. setPendingAction(() => deleteCanvasing(id, refetch))
   ↓
4. setConfirmationModal({ open: true, title, message })
   ↓
5. User klik "Hapus" di modal
   ↓
6. confirmRowAction() → execute pendingAction()
   ↓
7. fetch(`/api/marketing/canvasing/${id}`, { method: "DELETE" })
   ↓
8. API Route: DELETE /api/marketing/canvasing/[id]
   ├─ verifyAuth()
   ├─ hasPermission("canvasing:delete")
   ├─ CanvasingService.deleteRequest(id, userId)
   │   ├─ Check ownership atau super admin
   │   ├─ Check isLocked (tidak bisa delete jika locked)
   │   └─ Prisma delete
   └─ Return success
   ↓
9. toast.success("Data berhasil dihapus")
   ↓
10. refetch() → reload data dari server
```

### F. User Interaction: Cancel Approval

```
1. User klik "Batalkan Approval" di row (hanya untuk status APPROVED)
   ↓
2. handleCancelApproval(id, name)
   ↓
3. setPendingAction(() => cancelCanvasingApproval(id, refetch))
   ↓
4. setConfirmationModal({ open: true, title, message })
   ↓
5. User klik "Batalkan Approval" di modal
   ↓
6. confirmRowAction() → execute pendingAction()
   ↓
7. fetch(`/api/marketing/canvasing/${id}`, {
     method: "PATCH",
     body: JSON.stringify({ action: "cancel_approval" })
   })
   ↓
8. API Route: PATCH /api/marketing/canvasing/[id]
   ├─ verifyAuth()
   ├─ hasPermission("canvasing:update")
   ├─ CanvasingService.cancelApproval(id, userId)
   │   ├─ Check permission
   │   ├─ Update status: APPROVED → PENDING
   │   ├─ Clear approvedBy, approvedAt
   │   ├─ Unlink workOrderId (set null)
   │   └─ Prisma update
   └─ Return success
   ↓
9. toast.success("Approval dibatalkan, status kembali ke PENDING")
   ↓
10. refetch() → reload data
```

### G. User Interaction: Review Point Claim

```
1. User klik "Review Claim" di row (hanya jika ada pointClaim)
   ↓
2. openClaimModal(item)
   ↓
3. setClaimModal({ open: true, item, processing: false })
   ↓
4. Modal muncul dengan detail claim (bukti foto, keterangan, point value)
   ↓
5a. User klik "Approve":
   ↓
   handleApproveClaim(claimId)
   ↓
   axios.put(`/api/marketing/point-claims/${claimId}`, { action: "approve" })
   ↓
   API Route: PUT /api/marketing/point-claims/[id]
   ├─ verifyAuth()
   ├─ hasPermission("canvasing:verify")
   ├─ PointClaimService.reviewClaim(claimId, "approve", userId)
   │   ├─ Update status: PENDING → APPROVED
   │   ├─ Set reviewedBy, reviewedAt
   │   └─ Prisma update
   └─ Return success
   ↓
   toast.success("Claim poin berhasil disetujui")
   ↓
   refetch()

5b. User klik "Reject" + isi alasan:
   ↓
   handleRejectClaim(claimId, notes)
   ↓
   axios.put(`/api/marketing/point-claims/${claimId}`, {
     action: "reject",
     notes: notes.trim()
   })
   ↓
   API Route: PUT /api/marketing/point-claims/[id]
   ├─ verifyAuth()
   ├─ hasPermission("canvasing:verify")
   ├─ PointClaimService.reviewClaim(claimId, "reject", userId, notes)
   │   ├─ Update status: PENDING → REJECTED
   │   ├─ Set reviewedBy, reviewedAt, reviewNotes
   │   └─ Prisma update
   └─ Return success
   ↓
   toast.success("Claim poin ditolak")
   ↓
   refetch()
```

---

## 3. Permission Model

### Permission yang Digunakan

| Permission | Fungsi |
|-----------|--------|
| `canvasing:read` | Lihat list canvasing |
| `canvasing:verify` | Lihat list + review claim poin |
| `canvasing:create` | Buat canvasing baru |
| `canvasing:update` | Edit canvasing + cancel approval |
| `canvasing:delete` | Hapus canvasing |
| `canvasing:site_only` | (Legacy) Restrict by site |

### Permission Check di Frontend

```typescript
const permissions = {
  canRead: isSuperAdmin || hasPermission("canvasing:read") || hasPermission("canvasing:verify"),
  canCreate: isSuperAdmin || hasPermission("canvasing:create"),
  canUpdate: isSuperAdmin || hasPermission("canvasing:update"),
  canReview: isSuperAdmin || hasPermission("canvasing:update") || hasPermission("canvasing:verify"),
  canDelete: isSuperAdmin || hasPermission("canvasing:delete"),
};
```

### Session-Based Site Restriction (Backend)

```typescript
// Non-super-admin dengan siteIds → restricted
const isSiteRestricted = !isSuperAdmin && user.siteIds && user.siteIds.length > 0;

if (isSiteRestricted) {
  // Validate user-provided siteId filter
  if (filterSiteId && !user.siteIds.includes(filterSiteId)) {
    return emptyResponse; // Forbidden
  }
  // Default to first allowed site if no filter
  if (!filterSiteId) {
    filterSiteId = user.siteIds[0];
  }
}
```

**Catatan:** Restriction tidak bergantung pada permission `canvasing:site_only`. Langsung cek `session.siteIds`.

---

## 4. Data Model

### Canvasing Entity

```typescript
{
  id: string;
  nama: string;              // Nama customer
  noKtp: string;
  noTelpon: string;
  email?: string;
  alamat: string;
  kabel: number;             // Panjang kabel (meter)
  odp?: string;              // ODP terdekat
  paket: string;             // Paket internet
  sn?: string;               // Serial number ONT
  latitude?: number;
  longitude?: number;
  foto?: string;             // Foto lokasi
  fotoKtp?: string;          // Foto KTP
  status: "PENDING" | "APPROVED" | "REJECTED";
  salesId?: string;          // User ID sales
  mitraId?: string;          // Mitra ID (jika dari mitra)
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;       // User ID approver
  approvedAt?: Date;
  workOrderId?: string;      // Link ke work order (jika sudah approved)
  isLocked: boolean;         // Locked = tidak bisa edit/delete
  
  // Relations
  user?: {                   // Sales user
    id: string;
    name: string;
    email: string;
    siteId: string;
    site?: { id: string; name: string; };
  };
  mitra?: {                  // Mitra (jika mitraId ada)
    id: string;
    name: string;
  };
  workOrder?: {              // Work order terkait
    workOrderNumber: string;
    status: string;
  };
  pointClaim?: {             // Claim poin (jika ada)
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    buktiUrls: string[];     // Foto bukti instalasi
    keterangan: string;
    pointValue: number;
    reviewNotes?: string;
    reviewedAt?: Date;
    reviewedBy?: { name: string; };
  };
}
```

### DTO untuk List

```typescript
{
  id: string;
  nama: string;
  noTelpon: string;
  alamat: string;
  paket: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  salesName: string | null;  // user?.name ?? mitra?.name ?? null
  createdAt: string;         // ISO string
}
```

### Summary Stats

```typescript
{
  total: number;             // Total semua canvasing
  pending: number;           // Status PENDING
  approved: number;          // Status APPROVED
  rejected: number;          // Status REJECTED
  pendingClaims: number;     // Point claims yang PENDING review
}
```

---

## 5. API Endpoints

### GET /api/marketing/canvasing

**Query Params:**
- `page` (default: 1)
- `limit` (default: 10)
- `status` (optional: PENDING, APPROVED, REJECTED)
- `salesId` (optional: filter by sales)
- `siteId` (optional: filter by site)
- `search` (optional: search nama, noTelpon, alamat, paket)

**Response:**
```json
{
  "data": [CanvasingListItemDTO],
  "total": number,
  "page": number,
  "limit": number,
  "summary": {
    "total": number,
    "pending": number,
    "approved": number,
    "rejected": number,
    "pendingClaims": number
  }
}
```

**Authorization:**
- Session required
- Permission: `canvasing:read` OR `canvasing:verify`
- Site restriction: Non-super-admin dengan `siteIds` hanya lihat data dari site mereka

**Business Rules:**
- Jika user tidak punya `canvasing:read` atau `canvasing:verify` → hanya lihat canvasing milik sendiri (salesId = session.id)
- Jika user punya permission tapi restricted by site → filter by siteIds
- Super admin → lihat semua

### DELETE /api/marketing/canvasing/[id]

**Authorization:**
- Permission: `canvasing:delete`
- Ownership: Hanya bisa delete milik sendiri, kecuali super admin

**Business Rules:**
- Tidak bisa delete jika `isLocked = true`
- Tidak bisa delete jika sudah APPROVED dan ada workOrder

### PATCH /api/marketing/canvasing/[id]

**Body:**
```json
{
  "action": "cancel_approval"
}
```

**Authorization:**
- Permission: `canvasing:update`

**Business Rules:**
- Hanya bisa cancel jika status = APPROVED
- Set status → PENDING
- Clear approvedBy, approvedAt
- Unlink workOrderId (set null)

### PUT /api/marketing/point-claims/[id]

**Body (Approve):**
```json
{
  "action": "approve"
}
```

**Body (Reject):**
```json
{
  "action": "reject",
  "notes": "Alasan penolakan"
}
```

**Authorization:**
- Permission: `canvasing:verify`

**Business Rules:**
- Hanya bisa review jika claim status = PENDING
- Approve: status → APPROVED, set reviewedBy, reviewedAt
- Reject: status → REJECTED, set reviewedBy, reviewedAt, reviewNotes

---

## 6. State Management

### useCanvasingPageState (Orchestrator)

**Responsibility:** Compose semua hooks menjadi satu view model untuk presentation layer.

**Dependencies:**
- `useCanvasingListQuery()` → data fetching
- `useCanvasingPermissions()` → RBAC
- `useCanvasingRowActions()` → delete, cancel approval
- `useCanvasingClaimReview()` → approve/reject claim

**Output:** Single view model object dengan semua state dan handlers.

### useCanvasingListQuery (Data Fetching)

**State:**
- `items` → array of CanvasingListItemDTO
- `loading` → boolean
- `search` → string
- `statusFilter` → "ALL" | "PENDING" | "APPROVED" | "REJECTED"
- `siteId` → string | undefined
- `page` → number
- `totalPages` → number
- `summary` → CanvasingSummary

**Methods:**
- `setPage(page)` → change page
- `updateSearch(value)` → update search + reset page
- `updateStatusFilter(value)` → update filter + reset page
- `updateSiteId(value)` → update site filter + reset page
- `refetch()` → manual refetch

**Behavior:**
- Auto-fetch on mount
- Auto-fetch on dependency change (page, search, statusFilter, siteId)
- Request deduplication dengan `latestRequestRef`
- AbortController untuk cancel request saat unmount

### useCanvasingRowActions (Delete, Cancel Approval)

**State:**
- `confirmationModal` → { open, title, message, confirmLabel, processing }
- `pendingAction` → function yang akan dieksekusi setelah konfirmasi

**Methods:**
- `handleDelete(id, name)` → open confirmation modal untuk delete
- `handleCancelApproval(id, name)` → open confirmation modal untuk cancel approval
- `confirmRowAction()` → execute pendingAction
- `closeConfirmationModal()` → close modal + clear pendingAction

**Pattern:** Two-step confirmation dengan pending action.

### useCanvasingClaimReview (Approve/Reject Claim)

**State:**
- `claimModal` → { open, item, processing }
- `zoomImage` → string | null (URL foto yang di-zoom)

**Methods:**
- `openClaimModal(item)` → open modal dengan detail claim
- `closeClaimModal()` → close modal
- `handleApproveClaim(claimId)` → approve claim
- `handleRejectClaim(claimId, notes)` → reject claim dengan alasan
- `openZoomImage(url)` → zoom foto bukti
- `closeZoomImage()` → close zoom

---

## 7. Key Features

### A. Real-time Summary Cards

Summary cards (Total, Pending, Approved, Rejected, Pending Claims) di-update setiap kali data di-fetch. Aggregate dilakukan di backend dengan efficient query.

### B. Status Filter Tabs

User bisa filter by status dengan klik tab. Active tab di-highlight. Count per status ditampilkan di badge.

### C. Search Debouncing

Search tidak langsung trigger API call. Ada debounce 300ms untuk mengurangi request.

### D. Pagination

Server-side pagination dengan page number dan total pages. User bisa navigate dengan Previous/Next atau klik page number.

### E. Site Restriction Enforcement

Non-super-admin dengan `siteIds` hanya bisa lihat data dari site mereka. Enforcement di backend, bukan frontend.

### F. Ownership-Based Actions

Delete hanya bisa dilakukan oleh owner (salesId = session.id) atau super admin. Cancel approval bisa dilakukan oleh siapa saja dengan permission `canvasing:update`.

### G. Point Claim Review

Admin/verifier bisa approve/reject claim poin dari sales. Claim hanya bisa di-review jika status = PENDING. Setelah review, status berubah dan tidak bisa di-review lagi.

### H. Work Order Integration

Setelah canvasing APPROVED, bisa di-link ke work order. Jika approval dibatalkan, link ke work order di-clear.

---

## 8. Error Handling

### Frontend

- Network error → toast.error("Gagal menghubungi server")
- API error → toast.error(response.error || fallback message)
- Validation error → toast.error("Alasan penolakan harus diisi")
- Abort error → silent (request cancelled)

### Backend

- Unauthorized → 401 "Tidak terautentikasi"
- Forbidden → 403 "Anda tidak memiliki akses"
- Not Found → 404 "Data tidak ditemukan"
- Validation Error → 400 dengan detail error
- Internal Error → 500 "Gagal memproses request"

---

## 9. Performance Considerations

### A. Query Optimization

- Prisma include hanya field yang dibutuhkan
- Pagination untuk limit result set
- Index di kolom yang sering di-filter (salesId, mitraId, status, tenantId)

### B. Frontend Optimization

- Request deduplication dengan `latestRequestRef`
- AbortController untuk cancel stale requests
- Debounce search input
- Lazy load modals (hanya render saat open)

### C. Caching Strategy

- No client-side cache (always fresh data)
- Server-side cache bisa ditambahkan di API layer (Redis)
- Recommended TTL: 30 detik untuk list, 5 menit untuk summary

---

## 10. Security

### A. Authentication

- Session-based auth dengan secure cookie
- Token verification di setiap API call
- Auto-redirect ke login jika session expired

### B. Authorization

- RBAC enforcement di API layer
- Permission check sebelum action
- Ownership check untuk delete

### C. Site Restriction

- Session-based restriction (tidak bergantung permission flag)
- Validate user-provided siteId filter
- Default to first allowed site jika tidak ada filter

### D. Input Validation

- Zod schema validation di API layer
- Sanitize search input
- Validate claimId, notes, action

---

*Generated: 2026-05-08*
*Author: Claude (Autonomous)*
