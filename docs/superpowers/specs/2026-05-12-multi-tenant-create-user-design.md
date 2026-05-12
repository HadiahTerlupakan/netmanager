# Multi-Tenant Create User Tenant Enforcement Design

**Tanggal:** 2026-05-12
**Status:** Disetujui untuk dilanjutkan ke implementation plan setelah review file ini.

## Latar Belakang

Saat ini flow tambah user pada halaman admin users memiliki dua mode yang diharapkan:

1. **Superadmin** dapat memilih tenant target secara eksplisit.
2. **Non-superadmin** hanya boleh mengelola tenant miliknya sendiri, sehingga tenant target harus otomatis mengikuti `session.user.tenantId` tanpa dropdown dan tanpa bergantung pada input dari client.

Bug yang ditemukan terjadi ketika user tenant dengan custom role yang memiliki permission membuat user membuka flow create user, tetapi tenant tidak otomatis terbawa dengan aman. Akibatnya user baru dapat tercipta tanpa tenant, atau boundary tenant bergantung pada perilaku UI, bukan enforcement backend.

## Goal

Memastikan flow create user selalu tenant-safe dengan aturan berikut:

- superadmin tetap dapat memilih tenant target secara eksplisit,
- non-superadmin tidak pernah memilih tenant,
- backend selalu memaksa `tenantId` user baru untuk non-superadmin mengikuti `session.user.tenantId`,
- request non-superadmin tidak boleh dapat menyisipkan atau mengganti tenant lain melalui payload,
- user tenant dengan custom role yang memiliki `users:create` tetap bisa membuat user baru dalam tenant yang sama secara otomatis.

## Non-Goal

Perubahan ini tidak mencakup:

- redesign penuh permission matrix,
- migrasi besar arsitektur roles,
- perubahan lintas module yang tidak berkaitan langsung dengan create user tenant enforcement,
- perubahan perilaku superadmin selain menjaga flow yang sudah ada.

## Temuan Teknis Saat Ini

### UI

File utama: [app/admin/users/new/UsersNewClient.tsx](app/admin/users/new/UsersNewClient.tsx)

- Form create user hanya menampilkan tenant selector untuk user yang bisa membaca tenant.
- Flow non-superadmin secara desain tidak seharusnya memilih tenant dari UI.
- Namun payload create masih dapat bergantung pada state form atau request body, sehingga boundary tenant tidak boleh dipercayakan ke client.

### API dan Service

File utama:
- [app/api/admin/users/route.ts](app/api/admin/users/route.ts)
- [modules/users/services/AdminUserRouteService.ts](modules/users/services/AdminUserRouteService.ts)
- [modules/users/services/admin-user-route.create.ts](modules/users/services/admin-user-route.create.ts)

- Route create user mendelegasikan pembuatan user ke service layer.
- Jalur create saat ini belum setegas jalur update dalam memaksa boundary tenant untuk non-superadmin.
- Ada indikasi bahwa `tenantId` dari payload masih bisa ikut diproses pada create flow.

### Tenant Context dan Persistence

File utama:
- [lib/api/handler.ts](lib/api/handler.ts)
- [lib/prisma-extension.ts](lib/prisma-extension.ts)

- Request context sudah membawa `session.user.tenantId` ke Prisma tenant isolation.
- Prisma extension berfungsi sebagai lapisan isolasi terakhir.
- Namun create flow tidak boleh hanya mengandalkan auto-inject di Prisma; service layer harus menjadi sumber kebenaran tenant assignment agar intent bisnis jelas dan testable.

## Pendekatan yang Disetujui

Pendekatan yang dipilih adalah **opsi 3: backend enforcement + sinkronisasi UI**.

Artinya:

1. **Backend menjadi source of truth tenant assignment**.
2. **UI tetap dirapikan** agar tenant selector hanya relevan untuk superadmin dan payload non-superadmin tidak membangun asumsi tenant sendiri.
3. **Prisma extension tetap dipertahankan** sebagai defense-in-depth, bukan sebagai satu-satunya enforcement.

## Desain Perubahan

### 1. Tenant Assignment Rule

#### Superadmin
- Boleh mengirim `tenantId` target melalui form create user.
- Service create user memakai tenant target tersebut setelah validasi biasa.

#### Non-superadmin
- Tidak boleh menentukan tenant target dari request body.
- Service create user harus selalu menetapkan `tenantId = session.user.tenantId`.
- Bila `session.user.tenantId` kosong, request harus gagal dengan error yang jelas dan fail-closed.

### 2. Service-Level Enforcement

File target utama: [modules/users/services/admin-user-route.create.ts](modules/users/services/admin-user-route.create.ts)

Perubahan inti:

- centralize resolusi `targetTenantId` di service create user,
- hilangkan ketergantungan pada `payload.tenantId` untuk non-superadmin,
- pastikan data create final selalu sudah membawa `tenantId` yang benar sebelum masuk repository,
- pertahankan flow superadmin yang eksplisit.

Aturan final yang diinginkan:

- **superadmin** → `tenantId` final berasal dari target tenant yang dipilih,
- **non-superadmin** → `tenantId` final berasal dari tenant session,
- **tanpa tenant session pada non-superadmin** → fail.

### 3. UI Contract

File target utama: [app/admin/users/new/UsersNewClient.tsx](app/admin/users/new/UsersNewClient.tsx)

Perubahan inti:

- tenant selector tetap hanya muncul untuk superadmin,
- state default form untuk non-superadmin tidak menjadi sumber kebenaran tenant,
- payload submit untuk non-superadmin tidak perlu menjadi penentu tenant boundary,
- bila ada prefill/query param tenant, itu hanya relevan untuk superadmin.

Tujuannya bukan sekadar “membuat field terisi”, tetapi memastikan UI tidak menciptakan kontrak palsu bahwa client boleh menentukan tenant untuk user tenant biasa.

### 4. Defense-in-Depth

File target utama: [lib/prisma-extension.ts](lib/prisma-extension.ts)

Prisma extension tetap berfungsi sebagai pagar terakhir:

- create yang tidak menyertakan `tenantId` masih tetap bisa di-inject dari request tenant context,
- update tenant lintas boundary tetap diblok,
- tetapi perbaikan utama tetap dilakukan di service create agar intent bisnis eksplisit.

Jika implementasi menemukan ada celah tambahan yang aman untuk diperketat di extension tanpa mengubah kontrak superadmin, itu boleh dimasukkan sebagai pengaman tambahan yang minimal dan relevan.

## Testing Strategy

### Regression Test Utama

Tambahkan test yang membuktikan kasus berikut:

- user non-superadmin dalam tenant tertentu,
- memakai custom role yang mengizinkan `users:create`,
- melakukan create user,
- hasil create selalu memiliki `tenantId` yang sama dengan tenant session pembuat.

### Negative Test

Tambahkan test yang membuktikan:

- non-superadmin yang mengirim `tenantId` berbeda lewat payload tidak dapat membuat user di tenant lain,
- hasil akhir tetap tenant session miliknya atau request ditolak secara fail-closed, sesuai implementasi yang paling bersih.

### UI/Reference Data Test

Bila coverage test saat ini sudah menyentuh flow halaman create user, tambahkan regression test ringan untuk memastikan kontrak UI tidak mensyaratkan tenant picker bagi non-superadmin.

## Dampak yang Diharapkan

Setelah perubahan ini:

- superadmin tetap bisa membuat user untuk tenant mana pun yang dipilih,
- admin tenant dan user tenant dengan custom role hanya bisa membuat user untuk tenant mereka sendiri,
- user baru tidak lagi tercipta tanpa tenant pada flow tenant-scoped,
- boundary tenant tidak lagi bergantung pada hidden field atau state client.

## Risiko dan Mitigasi

### Risiko
- Regression pada flow superadmin bila tenant resolution disederhanakan terlalu agresif.
- Test existing create-user bisa gagal bila sebelumnya mengandalkan payload tenant dari client untuk non-superadmin.

### Mitigasi
- Pisahkan rule superadmin dan non-superadmin secara eksplisit di service.
- Tambahkan test untuk kedua mode agar kontraknya terdokumentasi.
- Pertahankan Prisma tenant isolation sebagai pengaman terakhir.

## Kriteria Selesai

Perubahan dianggap selesai bila:

1. non-superadmin create user selalu menghasilkan user dengan tenant session yang sama,
2. non-superadmin tidak bisa override tenant lewat payload,
3. superadmin flow tetap berjalan dengan tenant selector,
4. regression test untuk bug ini tersedia dan lulus,
5. tidak ada user tenant-scoped yang tercipta tanpa tenant dari flow ini.
