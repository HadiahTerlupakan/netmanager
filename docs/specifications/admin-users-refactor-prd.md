# PRD — Refactor Module admin/users

- **Tanggal**: 2026-07-09
- **Author**: agent
- **Scope**: `app/admin/users` (UI layer) + `app/api/admin/users` (API routes) + `modules/users` (backend)
- **Status**: Draft — menunggu approval sebelum eksekusi
- **Tipe**: `[CHANGED]` (refactor) + `[FIXED]` (bug & security) + `[SECURITY]` (permission leak)

---

## 1. Latar Belakang

Module admin/users sudah memakai **pola baru Clean Architecture** di backend
(`modules/users` terstruktur domain/repository/service/dto/mapper) dan secara
fungsional bekerja. Namun hasil review end-to-end menemukan:

1. **Anti-pattern React serius** di frontend (render-phase state updates) — rawan
   race condition & re-render berlebih di React 19 / Strict Mode.
2. **Bug type-safety nyata** di `UserRepository` (copy-paste cast salah field).
3. **Misplaced responsibility**: operasi `forceLogoutUser` ada di service
   `AdminUserPerformanceRouteService`, bukan `AdminUserRouteService`.
4. **Duplikasi ~80% UI** antara halaman New & Edit user.
5. **Pelanggaran standar `docs/standards/data-fetching.md`**: fetch polos tanpa
   TanStack Query, tanpa cache, tanpa AbortController.
6. **Permission leak**: `force-logout` di-alias ke `users:update` — tidak ada
   permission dedicated, sehingga siapa pun yang bisa edit user bisa force-logout
   user lain tanpa kontrol terpisah.
7. **God hook** `useUserList` (13 useState, logic campur).

PRD ini menetapkan scope, acceptance criteria, dan rencana eksekusi refactor
yang selaras dengan `CLAUDE.md` (Clean Architecture, SOT, anti-smell, standar
data-fetching, authorization).

> Catatan: Review ini belum mencakup `AdminUserPerformanceRouteService`,
> `admin-user-performance.*.ts`, `UserService.ts`, `UserLookupService`,
> `WorkingHoursSettings.tsx`, `LeaveBalanceSettings.tsx`, dan mobile services.
> Mereka **di luar scope** PRD ini dan akan dibuat PRD terpisah bila perlu.

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan
- Menghapus anti-pattern React render-phase setState di seluruh UI admin/users.
- Memperbaiki bug type-safety `overtimeCalcTypeNational` di `UserRepository`.
- Memindahkan `forceLogoutUser` ke `AdminUserRouteService` (correct ownership).
- Menghapus duplikasi UI antara page New & Edit via shared component.
- Memigrasi fetch UI ke TanStack Query (`useApi`) sesuai standar data-fetching.
- Mendelegasi responsibility `useUserList` ke hook-hook kecil terfokus.
- Menambah permission `users:force_logout` terpisah dari `users:update`.
- Menambahkan validasi typed response (`UserDetailDTO`) di API client.
- Menghapus type alias backward-compat `UserData` yang berbahaya.

### 2.2 Non-Tujuan
- Tidak mengubah kontrak API publik yang sudah dikonsumsi mobile (kecuali
  penambahan permission baru — lihat §6, breaking minor).
- Tidak refactor performance service & lookup service (scope terpisah).
- Tidak mengubah skema DB / Prisma (tidak ada migration).
- Tidak mengubah business logic payroll/overtime/attendance.
- Tidak menambah fitur baru fungsional — ini murni refactor + fix.

---

## 3. Prinsip Acuan (dari CLAUDE.md)

| Prinsip | Relevansi |
|---|---|
| Modular Monolith + Layered + Clean Architecture | Backend tetap di `modules/users`, UI tetap thin |
| API route = thin controller | Tidak boleh ada business logic di `app/api/` |
| Authorization logic HANYA di `lib/rbac.ts` & `modules/roles` | Permission `users:force_logout` harus didefinisikan di RBAC, bukan hardcode `users:update` di UI |
| Service layer TIDAK boleh ada authorization logic | `forceLogoutUser` di service murni data operation |
| Repository handle data isolation via `tenantId` filter | Tetap pertahankan, jangan regress |
| Standar data-fetching = TanStack Query `useApi` | UI wajib pakai `useApi`, bukan `fetch` polos |
| Error handling: `Result<T,E>` di service, `ApiErrors.*` di route | Pertahankan pola existing |
| Events untuk komunikasi antar module | Pertahankan `USER_CREATED/UPDATED/DEACTIVATED` |
| SOT: `docs/CHANGELOG.md` | Setiap task logis wajib entry |

---

## 4. Scope Detail

### 4.1 Backend (`modules/users` + `app/api/admin/users`)

#### 4.1.1 Bug type-safety `overtimeCalcTypeNational`
**File**: `modules/users/repositories/UserRepository.ts`

Saat ini (line ~73):
```ts
overtimeCalcTypeNational:
  data.overtimeCalcTypeNational as Prisma.UserCreateInput["overtimeCalcTypeNormal"],
//                                                              ^^^^^^^^^^^^^^^^^^^^^^
//                                                              SALAH — harusnya National
```
Bug copy-paste: cast ke field `overtimeCalcTypeNormal` padahal assign ke
`overtimeCalcTypeNational`. Karena pakai `as`, compiler tidak menangkap.

**Acceptance**:
- Cast diperbaiki ke `["overtimeCalcTypeNational"]` di `create` & `createWithSites`.
- Ekstrak helper `mapUserEnumFields(data)` untuk hapus duplikasi blok cast di
  kedua method.
- `npm run typecheck` lulus, tidak ada regression.

#### 4.1.2 Pindah `forceLogoutUser` ke `AdminUserRouteService`
**File**: `modules/users/services/AdminUserPerformanceRouteService.ts`,
`modules/users/services/AdminUserRouteService.ts`,
`app/api/admin/users/[id]/force-logout/route.ts`

Saat ini `forceLogoutUser(targetUserId)` ada di service performance — misplaced
karena force-logout adalah operasi user-management, bukan performance metric.

**Acceptance**:
- Method `forceLogoutUser(userId)` dipindah ke `AdminUserRouteService`.
- API route `force-logout/route.ts` instansiasi `AdminUserRouteService`, bukan
  `AdminUserPerformanceRouteService`.
- `AdminUserPerformanceRouteService` tidak lagi memiliki method `forceLogoutUser`.
- Tetap return entity yang sama (memuat `tokenVersion` & `name`).
- Event emit & `logActivity` tetap jalan dari route (tidak pindah ke service —
  tetap tanggung jawab route controller).
- Tidak ada consumer lain yang memanggil
  `AdminUserPerformanceRouteService.forceLogoutUser` (grep & update).

#### 4.1.3 Permission `users:force_logout` terpisah
**File**: `lib/rbac.ts`, `modules/roles/factories/RoleFactory.ts`, `prisma/seed*`

Saat ini UI hardcode `canForceLogout = hasPermission("users:update")` → leak:
admin yang hanya boleh edit tidak boleh otomatis bisa force-logout.

**Acceptance**:
- Tambah permission `users:force_logout` di definisi RBAC (`lib/rbac.ts`).
- Tambah ke `RoleFactory` default untuk role admin.
- Seed role admin existing diberi permission ini (data migration via seed
  script — **bukan** Prisma migration, karena permission disimpan di tabel
  `RolePermission`/role.permissions, bukan skema).
- UI `UserList.tsx` & `userColumns.tsx` pakai `users:force_logout` bukan
  `users:update` untuk tombol force-logout.
- API route `force-logout/route.ts` cek `permissions: ["users:force_logout"]`
  di `createHandler` config, bukan `users:update`.
- **Breaking**: admin yang sebelumnya hanya punya `users:update` TANPA
  `users:force_logout` akan kehilangan tombol force-logout sampai seed di-run.
  → wajib seed via deploy pipeline, tandai `Breaking: ✅ Ya` di changelog.

### 4.2 Frontend UI (`app/admin/users`)

#### 4.2.1 Hapus render-phase setState di `useUserList`
**File**: `app/admin/users/lib/useUserList.ts`

Saat ini pola:
```ts
const [prevLoadKey, setPrevLoadKey] = useState<string | null>(null);
const loadKey = `...`;
if (prevLoadKey !== loadKey) {
  setPrevLoadKey(loadKey);
  void loadUsers(); // side-effect di render body
}
```
ini melanggar `react-hooks/set-state-in-effect` & tidak aman concurrent.

**Acceptance**:
- Semua side-effect fetch & reset-page dipindah ke `useEffect` dengan
  dependency array eksplisit.
- Race condition diatasi via AbortController per-request (atau request-id
  flag) — response lama tidak menimpa response baru.
- Auto-reset page saat halaman kosong tetap berfungsi tapi via effect.
- Linting `react-hooks/set-state-in-effect` lulus.

#### 4.2.2 Hapus render-phase setState di `UsersNewClient`
**File**: `app/admin/users/new/UsersNewClient.tsx`

Pola `prevTenantParamKey` / `prevEmailValid` / `lastHydratedKey` /
`prevCheckingEmail` — semua setState saat render.

**Acceptance**:
- Sinkronisasi `tenantId` dari `searchParams` → `useEffect`.
- Hydrasi hasil `check-identifier` → pindahkan ke `useEffect` dengan
  dependency pada `checkData`/`checkIdentifierUrl`, ATAU refactor agar pakai
  `useApi` + derived state (TanStack Query sudah handle lifecycle).
- Tidak ada lagi `if (prev !== curr) setState(...)` di render body.

#### 4.2.3 Ekstrak shared form component (New & Edit)
**File baru**: `app/admin/users/components/UserFormSections.tsx`

`UsersNewClient.tsx` (~430 LOC) & `UsersDetailClient.tsx` (~620 LOC)
menduplikasi ~80% section UI: Account Info, Organization, Working Hours
(wrapper), Status & Sales, Leave Balance.

**Acceptance**:
- Ekstrak section yang identik ke `<UserFormSections>` menerima props
  `{ formData, errors, handleChange, sites, departments, roles, tenants,
  canReadTenants, selectedSites, setSelectedSites, workingHoursBindings,
  leaveQuotaBindings, isViewMode? }`.
- New & Edit page hanya berbeda di: initial state, submit handler, label
  tombol, dan field yang disabled (email readonly di edit).
- Reduksi duplikasi ~400 LOC.
- Tidak ada drift label/field antara New & Edit setelah unify.

#### 4.2.4 Pecah `useUserList` jadi hook terfokus
**File baru**:
- `app/admin/users/lib/useUserFetch.ts` (query + pagination + debounce)
- `app/admin/users/lib/useUserSelection.ts` (checkbox state)
- `app/admin/users/lib/useUserMutations.ts` (delete + force-logout)

**Acceptance**:
- `useUserList` menjadi thin orchestrator yang compose 3 hook di atas.
- Tiap hook punya single responsibility.
- Behavior UI identik (search, debounce, pagination, selection, delete,
  force-logout).
- `useUserFetch` pakai TanStack Query `useApi` dengan key yang memuat
  `page|search|status|tenantId` → otomatis dedup & abort.

#### 4.2.5 Migrasi fetch ke TanStack Query
**File**: `app/admin/users/lib/userApi.ts`, `userDetailApi.ts`,
`useUserDetailData.ts`

Saat ini semua fetch memakai `fetch` polos — melanggar
`docs/standards/data-fetching.md`.

**Acceptance**:
- `fetchUsers/deleteUser/forceLogoutUser` → wrapper di atas `useApi` /
  `useMutation` (atau tetap fungsi mutasi untuk dipanggil manual dari mutation
  hook, tapi GET list pakai `useApi`).
- `useUserReferenceData` pakai 4× `useApi` paralel (dedup otomatis).
- `fetchAdminUserDetail` return type `UserDetailDTO | null` (bukan
  `unknown`), hapus cast `as UserData` di consumer.
- Tidak ada lagi `useEffect` + `fetch` + `setState` manual untuk GET.

#### 4.2.6 Hapus type alias backward-compat `UserData`
**File**: `app/admin/users/[id]/UsersDetailClient.tsx`

```ts
type UserData = UserDetailDTO & {
  department?: ...; sites?: ...; departments?: ...;
};
```
Tiga alias untuk field sama mempertahankan duplikasi & melanggar
parse-don't-validate.

**Acceptance**:
- Hapus alias `UserData`, pakai `UserDetailDTO` langsung.
- Update consumer yang pakai `usr.department`/`usr.departments`/`usr.sites`/
  `usr.site` → ke field kanonik `department` / `site`.
- Helper `getSelectedSitesFromUser`/`getSitesFromUser` di
  `user-detail-helpers.ts` diupdate bila perlu.

#### 4.2.7 Immutable update di `MultiSiteSelect.toggleSite`
**File**: `app/admin/users/components/MultiSiteSelect.tsx`

```ts
const firstSite = newSites[0];
if (firstSite) { firstSite.isPrimary = true; } // mutasi object dari state
```
**Acceptance**:
- Ganti dengan `.map()` immutable: `newSites.map((s, i) => i === 0 ? {...s, isPrimary: true} : s)`.

---

## 5. Out of Scope (dikecualikan)

- `AdminUserPerformanceRouteService` & `admin-user-performance.*.ts` (5 file).
- `UserService.ts`, `UserLookupService`, `Mobile*Service.ts`.
- `WorkingHoursSettings.tsx`, `LeaveBalanceSettings.tsx`, `UsersDetailView.tsx`.
- `UserPerformanceStats.tsx`, `SalesPerformanceStats.tsx`, `LeaveQuotaSummary.tsx`.
- Backend `UserService.helpers.ts` & `UserService.types.ts`.
- Endpoint `performance` & `sales-performance` route.

Alasan: PRD fokus pada critical/high smell yang menyangkut correctness, security,
dan standar. Layer performance & settings akan dievaluasi di PRD terpisah agar
scope tetap terkontrol dan verifikasi end-to-end feasible.

---

## 6. Breaking Changes & Risiko

| Item | Breaking? | Mitigasi |
|---|---|---|
| Permission `users:force_logout` baru | ✅ Ya (minor) | Seed role admin existing saat deploy; changelog tandai `Breaking: ✅ Ya`; pipeline `prisma:setup`/seed harus jalan |
| Pindah `forceLogoutUser` antar service | ❌ Tidak (internal) | Grep semua consumer, update |
| Refactor `useUserList` | ❌ Tidak | Behavior test manual di browser |
| Ekstrak `UserFormSections` | ❌ Tidak | Visual QA New & Edit page |
| Hapus `UserData` alias | ❌ Tidak | Typecheck + runtime test form edit |

**Tidak ada Prisma migration** (tidak ubah skema). Permission baru disimpan via
seed di tabel data, bukan DDL.

---

## 7. Acceptance Criteria (Definisi Selesai)

### 7.1 Backend
- [ ] `overtimeCalcTypeNational` cast diperbaiki + helper ekstrak.
- [ ] `forceLogoutUser` pindah ke `AdminUserRouteService`.
- [ ] Permission `users:force_logout` terdefinisi di RBAC & RoleFactory.
- [ ] Seed menambahkan permission ke role admin existing.
- [ ] API route force-logout cek permission baru.
- [ ] `npm run typecheck` lulus untuk seluruh changed files.
- [ ] Tidak ada consumer lama `AdminUserPerformanceRouteService.forceLogoutUser`.

### 7.2 Frontend
- [ ] Tidak ada lagi render-phase `setState` di `useUserList` & `UsersNewClient`.
- [ ] `useUserList` dipecah jadi 3 hook; behavior identik.
- [ ] `UserFormSections` shared; duplikasi New & Edit < 50 LOC sisa.
- [ ] Semua GET UI pakai `useApi` (TanStack Query).
- [ ] `fetchAdminUserDetail` return `UserDetailDTO | null` (no `unknown`).
- [ ] `UserData` alias dihapus; consumer pakai `UserDetailDTO`.
- [ ] `MultiSiteSelect.toggleSite` immutable.
- [ ] `lsp_diagnostics` clean di changed files.
- [ ] Browser QA: list (search/paginate/filter), New, Edit, View, Compare,
      Delete, Force-logout — semua happy path jalan.

### 7.3 Dokumen & SOT
- [ ] Satu entry per task logis di `docs/CHANGELOG.md` `[Unreleased]`.
- [ ] Entry permission pakai `[SECURITY]` + `Breaking: ✅ Ya`.
- [ ] Entry refactor pakai `[CHANGED]`.
- [ ] Entry bug fix `overtimeCalcTypeNational` pakai `[FIXED]`.
- [ ] Tidak ada entry sebelum task selesai (aturan SOT).

---

## 8. Rencana Eksekusi (Urutan Task Logis)

Setiap task = 1 commit + 1 entry changelog. Urutan diatur agar setiap task
independen & verifiable.

1. **[FIXED] Bug cast `overtimeCalcTypeNational`** + ekstrak helper enum.
2. **[CHANGED] Pindah `forceLogoutUser` ke `AdminUserRouteService`** +
   update route & consumer.
3. **[SECURITY] Tambah permission `users:force_logout`** (RBAC + RoleFactory +
   seed + route + UI) — `Breaking: ✅ Ya`.
4. **[CHANGED] Refactor `useUserList`** (hapus render-phase setState +
   AbortController + pecah jadi 3 hook).
5. **[CHANGED] Migrasi fetch UI ke TanStack Query** (`useApi`) + typed
   `fetchAdminUserDetail`.
6. **[CHANGED] Hapus alias `UserData`** + update consumer.
7. **[CHANGED] Ekstrak `UserFormSections`** (New & Edit).
8. **[FIXED] Immutable `MultiSiteSelect.toggleSite`**.

---

## 9. Verifikasi Plan

### 9.1 Statis
- `npm run typecheck` di changed files.
- `npm run lint` di changed files.
- `lsp_diagnostics` clean untuk changed files (parallel).

### 9.2 Dinamis (wajib, bukti visual)
- **List**: search (debounce), ganti status filter, pagination, multi-select
  → Compare Bar muncul, link compare bawa 2+ id.
- **New user**: validasi email real-time, generate password, pilih multi-site
  + set primary, submit → sukses redirect.
- **Edit user**: load data existing, ubah field, tombol Simpan disabled saat
  belum ada perubahan, submit → sukses.
- **View mode**: `/admin/users/{id}?view=true` render read-only.
- **Delete**: modal konfirmasi → hapus → list refresh.
- **Force-logout**: tombol muncul hanya untuk user dengan
  `users:force_logout`, bukan `users:update`; self force-logout ditolak.
- **Compare**: pilih 2 user → bandingkan → export PDF.

### 9.3 Akses permission
- Buat test role dengan `users:update` TAPI tanpa `users:force_logout`:
  tombol force-logout tidak muncul, API 403.

---

## 10. Estimasi

| Task | Effort |
|---|---|
| 1. Bug cast | XS |
| 2. Pindah forceLogout | S |
| 3. Permission baru (breaking) | M |
| 4. Refactor useUserList | M |
| 5. Migrasi TanStack Query | M |
| 6. Hapus UserData alias | S |
| 7. Ekstrak UserFormSections | M |
| 8. Immutable MultiSiteSelect | XS |

Total: ~3-4 jam pekerjaan fokus + QA browser.

---

## 11. Catatan SOT

PRD ini BUKAN entry changelog. PRD adalah dokumen spesifikasi. Entry
changelog hanya ditulis **setelah masing-masing task selesai** sesuai aturan
SOT di `CLAUDE.md` §"SOT & Changelog Policy". Setiap task di §8 menghasilkan
satu entry dengan format yang ditentukan.

---

*Dibuat 2026-07-09 oleh agent. Menunggu approval user sebelum eksekusi §8.*