# Multi-Tenant Source of Truth

## Tujuan
Dokumen ini mendefinisikan source of truth untuk enforcement multi-tenant di `netmanager`, supaya route, service, repository, dan mobile/client tidak memakai asumsi yang berbeda.

## Prinsip inti
1. **Backend adalah source of truth.** UI/mobile hanya boleh menjadi lapisan UX, bukan boundary keamanan.
2. **Tenant isolation riil ditegakkan di Prisma extension** melalui `withTenantIsolation()` di `lib/prisma-extension.ts`.
3. **Request tenant context harus dibind secara eksplisit** sebelum handler menjalankan service/repository yang memakai Prisma.
4. **Permission check tidak sama dengan tenant isolation.** Helper RBAC/authorization hanya memutuskan boleh/tidak secara fitur, sedangkan tenant isolation memutuskan data tenant mana yang bisa disentuh.
5. **Site/gudang restriction adalah lapisan tambahan**, bukan pengganti tenant isolation.
6. **Mobile/client feature guard hanya UX layer.** Guard seperti `useFeatureGuard`, `Can`, tab `href: null`, dan redirect layout tidak boleh dianggap sebagai boundary keamanan; backend API authorization dan tenant isolation tetap source of truth.

## Source of truth per lapisan

### 1. Tenant resolution
- File: `lib/tenant-context.ts`
- Fungsi utama: `getTenantIdFromContext()`
- Sumber tenant context:
  - NextAuth token (web)
  - mobile bearer token
  - customer/investor cookie
  - request-scoped cache / AsyncLocalStorage

### 2. Request-scoped tenant binding
- File: `lib/api/handler.ts`
- Fungsi utama: `createHandler()`
- Wajib memakai `runWithRequestTenantContext()` agar tenant context eksplisit tersedia untuk downstream query.

### 3. Data isolation
- File: `lib/prisma-extension.ts`
- Fungsi utama: `withTenantIsolation()`
- Semua query Prisma melalui `lib/prisma.ts` otomatis mendapat enforcement tenant, kecuali model yang sengaja di-ignore.

### 4. Auth / permission
- File: `lib/auth.ts`, `lib/authorization-middleware.ts`, `lib/rbac.ts`
- Fungsi utama:
  - `verifyAuth()`
  - `getUserPermissions()`
  - `authorize*()`
  - `hasPermission()`
- Tanggung jawab: memutuskan apakah user memiliki hak fitur/aksi.
- Bukan source of truth untuk tenant scoping.

### 5. Domain-level scoping tambahan
- File: module service / repository
- Contoh yang baik: `modules/work-order/repositories/WorkOrderRepository.ts`
- Domain service boleh menambah guard site/gudang/detail-by-id, tetapi tidak boleh melemahkan tenant isolation.

## Aturan implementasi
1. Semua API route baru yang mengakses data tenant **harus** memakai `createHandler()` atau wrapper lain yang setara dalam binding tenant context.
2. Jika route memakai `secure()`, wrapper itu harus memberi guarantee tenant binding setara `createHandler()`.
3. Service inventory/work-order/finance yang memproses ID lintas resource harus menambah validasi domain-level yang eksplisit untuk menghindari false sense of safety.
4. Helper seperti `validateGudangAccess()` harus jelas kontraknya:
   - apa yang divalidasi (tenant, site, atau keduanya)
   - apa yang **tidak** divalidasi
5. Mobile guards seperti `useFeatureGuard`, `Can`, tab `href: null`, dan redirect layout tetap dipertahankan sebagai UX layer, tetapi tidak boleh dipakai sebagai bukti keamanan backend.

## Implikasi untuk hardening saat ini
1. `lib/api/secure-handler.ts` harus disejajarkan dengan `createHandler()` untuk request tenant binding.
2. `modules/inventory/services/InventoryOpnameService.ts` harus menambahkan domain guard eksplisit untuk lookup `barang`, `gudang`, dan `barangGudang`.
3. `modules/inventory/utils/validation.ts` harus diubah dari helper site-only yang ambigu menjadi helper dengan kontrak jelas.
4. Guard mobile tetap dipertahankan sebagai UX layer, tetapi harus ditandai dan didokumentasikan sebagai non-security boundary.

## Non-goals
- Menjadikan mobile/client sebagai enforcement layer.
- Mengganti Prisma extension sebagai enforcement utama.
- Refactor besar lintas semua module jika hardening kecil sudah cukup menutup gap.
