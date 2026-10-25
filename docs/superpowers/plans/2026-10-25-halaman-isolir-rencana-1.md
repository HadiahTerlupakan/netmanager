# Halaman Isolir — Rencana 1: isi per tenant dan halaman di router

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap tenant mengatur halaman isolirnya di Pengaturan → Halaman Isolir. Router mode
"Halaman di router" menyajikannya dari `webproxy/error.html`, dan router mode "Redirect"
membelokkan ke URL manual.

**Architecture:**
- Satu renderer murni mengubah konfigurasi tenant (ditambah default) menjadi satu file HTML
  ≤ 24 KiB.
- Provisioning tidak lagi menerima `isolirUrl` mentah. Ia menerima `IsolirProvisioning`
  hasil `resolveIsolirProvisioning(router)`, yang menentukan isi proxy access, address list,
  dan file halaman.
- Menyimpan pengaturan memicu pengiriman file ke router-router tenant di latar belakang. Hasil
  per router dicatat di baris router.

**Tech Stack:** Next.js App Router, Prisma (PostgreSQL), node-routeros-v2, sharp, zod,
Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-halaman-isolir-design.md`. Rencana ini mencakup
bagian 1, 2 (mode Halaman di router dan Redirect dengan URL manual), dan 3. Mode Server pusat
(bagian 4) adalah Rencana 2. Domain isolir tenant (bagian 5, termasuk Redirect ke domain
tenant) adalah Rencana 3.

## Global Constraints

- Ukuran halaman di router: **maks 24 KiB** (`ROUTER_PAGE_MAX_BYTES = 24 * 1024`). Diukur di
  lab: 32 KiB lewat API masih utuh, 64 KiB memutus koneksi.
- Halaman di router: satu file HTML, CSS inline, **tanpa `<script>`**, tanpa aset luar. Logo
  hanya sebagai data URI.
- Teks tenant di-escape HTML. Karena RouterOS mengganti `$(...)` di halaman web proxy, setiap
  `$` juga ditulis sebagai entitas `&#36;`.
- Pesan dirender sebagai teks biasa: baris baru menjadi `<br>`, tanpa HTML atau markdown.
- Default bila kosong: judul `"Layanan Internet Anda Sedang Diisolir"`; nama ISP = nama
  tenant, atau `"Layanan Internet"` untuk router tanpa tenant; pesan = `"Layanan internet Anda
  dihentikan sementara. Silakan lakukan pembayaran atau hubungi layanan pelanggan kami agar
  layanan aktif kembali."`; rekening = `CompanyBankAccount` aktif tenant.
- Mode router: enum `IsolirMode { ROUTER_PAGE, REDIRECT }`, default `ROUTER_PAGE`. Migrasi:
  router dengan `isolirUrl` tidak kosong → `REDIRECT`.
- `REDIRECT` di Rencana 1 wajib punya `isolirUrl`, dan validasi menolak bila kosong.
- Setting global `ISOLIR_URL` tidak dipakai lagi oleh provisioning.
- Proxy access billing tetap ber-comment `added by netmanager - 10.127.0.0/18`, dan file
  halamannya `webproxy/error.html`.
- Permission baru: resource `isolir_page` (aksi `read`, `update`) di grup `PENGATURAN`
  (`lib/permission-config.ts`).
- Ikuti pola modul yang ada (route `createHandler`, service → repository, prisma extension
  untuk isolasi tenant). Tidak ada dependency baru, karena `sharp` sudah ada.
- Komentar menjelaskan *mengapa*, berbahasa Indonesia seperti kode sekitarnya.

## Review Focus

1. **Tenant mengisi teks panjang atau rekening sangat banyak**, sehingga HTML > 24 KiB. Yang
   diharapkan: logo dibuang lebih dulu, lalu pesan dipotong dengan `…`. Penyimpanan tetap
   berhasil, dan pratinjau memberi tahu apa yang dibuang (Task 3).
2. **Teks berisi `<script>`, `"`, atau `$(user)`**: tampil apa adanya sebagai teks, tidak
   pernah dieksekusi, dan tidak diganti RouterOS (Task 3).
3. **Router tenant lain atau router tanpa tenant**: pengiriman dan pratinjau tenant A tidak
   pernah menyentuh router tenant B (Task 6).
4. **Router offline atau API gagal saat pengiriman**: penyimpanan tetap sukses, router
   tercatat gagal dengan pesan, dan router lain tetap dikirimi (Task 6).
5. **Router pindah mode** (Redirect ↔ Halaman di router): entri host isolir lama di
   `netmanager_allow` hilang dan proxy access berganti action. Saat router dihapus, file
   halaman ikut terhapus (Task 5).

---

### Task 1: Skema — model `IsolirPage`, mode dan status kirim router

**Files:**
- Modify: `prisma/schema.prisma` (model baru, `MikroTikRouter`, back-relation di `Tenant`)
- Create: `prisma/migrations/20261025090000_add_isolir_page/migration.sql`
- Modify: `lib/permission-config.ts` (tambahkan `"isolir_page"` ke `PENGATURAN`)

**Interfaces:**
- Produces:
  - `model IsolirPage { id String @id @default(uuid()); tenantId String? @unique; tenant Tenant?
    @relation(... onDelete: Restrict); ispName String?; title String?; message String?;
    logoUrl String?; payments Json @default("[]"); whatsappNumber String?; whatsappText
    String?; linkLabel String?; linkUrl String?; contactText String?; primaryColor String?;
    createdAt; updatedAt; @@map("isolir_pages") }`
  - `enum IsolirMode { ROUTER_PAGE REDIRECT }`
  - `MikroTikRouter` mendapat `isolirMode IsolirMode @default(ROUTER_PAGE)`,
    `isolirPageHash String?`, `isolirPageSyncedAt DateTime?`, `isolirPageError String?`

- [ ] **Step 1:** Tambahkan model, enum, dan kolom di atas ke `schema.prisma`.
  - `logoUrl` kosong berarti memakai logo tenant.
  - `payments` berisi array `{ label: string; number: string; holder: string }`.
- [ ] **Step 2:** Tulis migration SQL: create enum, create table beserta unique index
  `tenantId`, alter table `"MikroTikRouter"` (model ini tanpa `@@map`), lalu
  `UPDATE ... SET "isolirMode" = 'REDIRECT' WHERE COALESCE(TRIM("isolirUrl"), '') <> ''`.
- [ ] **Step 3:** Run `npx prisma validate && npx prisma generate && npx tsc --noEmit -p .`.
  Expected: tanpa error.
- [ ] **Step 4:** Jalankan migrasi terhadap DB tes. Lihat `vitest.config.db.ts` dan
  `tests/db/` untuk caranya. Pastikan router ber-`isolirUrl` menjadi `REDIRECT`. Tambahkan
  tes `tests/db/isolir-mode-migration.test.ts` bila pola tests/db mendukung data seed sebelum
  migrasi. Kalau tidak didukung, catat hasil query manual di laporan.
- [ ] **Step 5:** Commit `feat(isolir): skema halaman isolir dan mode router`.

### Task 2: Konten — default, logo, dan resolver

**Files:**
- Create: `modules/network/isolir/isolir-page.types.ts`
- Create: `modules/network/isolir/IsolirPageRepository.ts`
- Create: `modules/network/isolir/isolir-content.ts`
- Create: `modules/network/isolir/isolir-logo.ts`
- Test: `tests/modules/network/isolir-content.test.ts`, `tests/modules/network/isolir-logo.test.ts`

**Interfaces:**
- Produces:
  - `type IsolirPayment = { label: string; number: string; holder: string }`
  - `type IsolirContent = { ispName: string; title: string; message: string; logoDataUri:
    string | null; payments: IsolirPayment[]; whatsapp: { number: string; text: string } |
    null; link: { label: string; url: string } | null; contactText: string | null;
    primaryColor: string }`
  - `IsolirPageRepository.findByTenant(tenantId: string | null): Promise<IsolirPage | null>`
    dan `upsertForTenant(tenantId: string, data: IsolirPageInput): Promise<IsolirPage>`
  - `resolveIsolirContent(tenantId: string | null): Promise<IsolirContent>`
  - `buildLogoDataUri(source: string | null): Promise<string | null>`
  - `DEFAULT_PRIMARY_COLOR = "#1d4ed8"`

- [ ] **Step 1: Tes gagal untuk `resolveIsolirContent`** dengan repository, tenant, bank, dan
  logo yang di-mock.
  - `"tenant tanpa IsolirPage memakai default"`: `title`, `message`, dan `ispName` sesuai
    Global Constraints. `payments` berasal dari bank aktif
    `[{label: bankName, number: accountNumber, holder: accountName}]`. `whatsapp` dan `link`
    bernilai `null`.
  - `"isian tenant mengalahkan default"`: semua field terisi dipakai apa adanya, dan
    `payments` dari IsolirPage yang tidak kosong menggantikan rekening bank.
  - `"router tanpa tenant"`: `resolveIsolirContent(null)` memberi `ispName "Layanan Internet"`
    dan tidak membaca bank atau logo.
  - `"whatsapp hanya bila nomor diisi"`: nomor `"0812 3456-789"` dinormalisasi menjadi
    `"628123456789"`. Teks kosong menjadi `""`.
- [ ] **Step 2:** Run `npx vitest run tests/modules/network/isolir-content.test.ts`.
  Expected: FAIL (modul belum ada).
- [ ] **Step 3:** Implementasikan.
  - Nama tenant dibaca dari `prismaAuth.tenant`, karena `Tenant` ada di ignoreModels.
  - Bank dibaca lewat `CompanyBankAccountRepository.findActive(tenantId)`.
  - Logo dibaca lewat `getLogoSettings(tenantId).logoAplikasi`, kecuali `IsolirPage.logoUrl`
    diisi.
  - Semua pembacaan berjalan di dalam `runAsSystemContext` bila dipanggil dari latar
    belakang. Ikuti pola `lib/tenant-context`.
- [ ] **Step 4: Tes gagal untuk `buildLogoDataUri`.**
  - Gambar PNG 800×800 menghasilkan `data:image/webp;base64,...` dengan sisi terpanjang
    ≤ 160 px dan panjang ≤ 8 KiB.
  - `null`, URL gagal diunduh, atau berkas bukan gambar menghasilkan `null`, tidak melempar.
- [ ] **Step 5:** Implementasikan dengan `sharp` (`resize({ width: 160, height: 160, fit:
  "inside" })`, webp quality 70). Path lokal dibaca lewat helper yang dipakai
  `resolveLogoUrl`/`saveFile`, sedangkan URL http(s) diunduh dengan timeout 5 dtk.
- [ ] **Step 6:** Run kedua tes. Expected: PASS.
- [ ] **Step 7:** Commit `feat(isolir): isi halaman isolir per tenant dengan default`.

### Task 3: Renderer HTML

**Files:**
- Create: `modules/network/isolir/isolir-render.ts`
- Test: `tests/modules/network/isolir-render.test.ts`

**Interfaces:**
- Consumes: `IsolirContent` (Task 2)
- Produces:
  - `ROUTER_PAGE_MAX_BYTES = 24 * 1024`
  - `type IsolirRenderResult = { html: string; hash: string; dropped: Array<"logo" |
    "message"> }`
  - `renderIsolirPage(content: IsolirContent): IsolirRenderResult`
  - `hash` adalah 16 karakter hex pertama dari sha256 HTML.

- [ ] **Step 1: Tes gagal.**
  - `"menampilkan semua bagian"`: HTML memuat judul, nama ISP, pesan, setiap rekening
    (label, nomor, atas nama), `wa.me/628123456789` beserta teks ter-encode, label dan URL
    link, kontak, serta warna utama pada CSS. Ada `<meta name="viewport"`.
  - `"tanpa script dan aset luar"`: tidak ada `<script`, `src="http`, maupun `href="http`
    selain tautan WA dan link tenant (`<a>`). Logo hanya `src="data:`.
  - `"escape"`: pesan `<script>alert(1)</script> "x" $(user)` muncul sebagai
    `&lt;script&gt;…&quot;x&quot; &#36;(user)`. Tidak ada `$(` mentah di mana pun dalam HTML.
  - `"baris baru menjadi <br>"`.
  - `"terlalu besar: logo dibuang dulu"`: logo 20 KiB ditambah pesan pendek menghasilkan
    `dropped = ["logo"]`, dan `Buffer.byteLength(html) <= ROUTER_PAGE_MAX_BYTES`.
  - `"terlalu besar: pesan dipotong"`: pesan 40 KiB menghasilkan `dropped` berisi
    `"message"`, pesan diakhiri `…`, dan ukuran ≤ batas.
  - `"hash stabil"`: isi sama menghasilkan hash sama, sedangkan isi beda menghasilkan hash
    beda.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementasikan sebagai template string. Tidak memakai React, karena
  hasilnya file statis untuk router. Tata letak mobile-first, satu kolom, kartu putih di atas
  latar `primaryColor` muda.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(isolir): renderer halaman isolir untuk router`.

### Task 4: API pengaturan dan pratinjau

**Files:**
- Create: `modules/network/isolir/IsolirPageService.ts`
- Create: `lib/validations/isolir-page.ts`
- Create: `app/api/admin/isolir-page/route.ts` (GET, PUT)
- Create: `app/api/admin/isolir-page/preview/route.ts` (GET → `text/html`)
- Modify: `modules/network/index.ts` (ekspor publik, sesuai `tests/architecture/module-public-api.test.ts`)
- Test: `tests/api/admin/isolir-page-route.test.ts`

**Interfaces:**
- Consumes: Task 2, Task 3; `pushIsolirPageToTenantRouters` (Task 6). Task ini memanggilnya
  lewat parameter injeksi supaya Task 4 bisa dites sebelum Task 6.
- Produces:
  - `isolirPageSchema` (zod): semua string opsional dan di-trim. `payments` maks 10 item, dan
    setiap field-nya wajib bila item ada. `primaryColor` `^#[0-9a-fA-F]{6}$`. `linkUrl`
    harus `http(s)://`. Batas panjang: judul 120, pesan 2000, `contactText` 500.
  - `IsolirPageService.get(tenantId)`: `{ page: IsolirPage | null; preview:
    IsolirRenderResult }`
  - `IsolirPageService.update(tenantId, input)`: `{ page; preview }`, sambil memicu
    pengiriman tanpa ditunggu.
  - `IsolirPageService.renderForTenant(tenantId)`: `IsolirRenderResult`

- [ ] **Step 1: Tes route gagal.**
  - Tanpa `isolir_page:read` → 403. Tanpa `isolir_page:update` pada PUT → 403.
  - PUT valid → 200 dengan `preview.dropped`, dan pengiriman terpanggil sekali dengan
    tenantId sesi.
  - PUT dengan `primaryColor "red"` → 400.
  - GET preview → `content-type: text/html` dengan isi HTML renderer.
  - Super admin tanpa tenant mendapat 400 `"Pilih tenant"`, sesuai cara route pengaturan lain
    menangani super admin. Ikuti pola itu bila berbeda.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementasikan mengikuti pola `app/api/admin/company-bank-accounts/route.ts`
  (`createHandler`, `hasPermission`, dynamic import modul).
- [ ] **Step 4:** Run. Expected: PASS. Run juga `npx vitest run tests/architecture`.
- [ ] **Step 5:** Commit `feat(isolir): API pengaturan dan pratinjau halaman isolir`.

### Task 5: Provisioning per mode

**Files:**
- Create: `modules/network/isolir/isolir-provisioning.ts`
- Create: `modules/network/services/mikrotik-provisioning.isolir-page.ts`
- Modify: `modules/network/services/MikroTikProvisioningService.ts` (parameter
  `isolirUrl` → `isolir`)
- Modify: `mikrotik-provisioning.proxy.ts`, `mikrotik-provisioning.firewall.ts`,
  `mikrotik-provisioning.firewall.helpers.ts`
- Modify (call site): `mikrotik-router.provisioning.ts` (create dan delete),
  `RouterReconfigureRouteService.ts`, `mikrotik-vpn-migration.routeros.ts`,
  `radius-runtime.helpers.ts` (hapus `ISOLIR_URL` dari `getRouterReconfigureSettings`)
- Test: `tests/modules/network/isolir-provisioning.test.ts`, perluas
  `mikrotik-provisioning-proxy.test.ts`, `mikrotik-provisioning-firewall.test.ts`, dan
  `mikrotik-provisioning-radius-src.test.ts`

**Interfaces:**
- Consumes: `renderIsolirPage`, `resolveIsolirContent`
- Produces:
  - `type IsolirProvisioning = { mode: "ROUTER_PAGE"; html: string; hash: string } | { mode:
    "REDIRECT"; target: string }`. `target` berisi host[/path] tanpa skema.
  - `resolveIsolirProvisioning(router: { isolirMode: IsolirMode; isolirUrl: string | null;
    tenantId: string | null }): Promise<IsolirProvisioning>`
  - `splitIsolirTarget(url: string): { host: string; target: string }`
  - `writeIsolirPageFile(connection, html: string, logs: string[]): Promise<void>`
  - `removeIsolirPageFile(connection, logs: string[]): Promise<void>`
  - `provisionRadius(routerDetails, radiusServerIp, radiusSecret, isolir: IsolirProvisioning
    | null, authPort, accountingPort, srcAddress?)`. `deprovisionRadius(routerDetails,
    radiusServerIp)` tidak lagi menerima URL.

- [ ] **Step 1: Tes gagal.**
  - `resolveIsolirProvisioning`:
    - `REDIRECT` + `"https://isolir.x.id/abc"` → `{mode:"REDIRECT", target:"isolir.x.id/abc"}`.
    - `ROUTER_PAGE` → `{mode:"ROUTER_PAGE", html, hash}` dari renderer, dengan tenant sesuai
      router.
    - `REDIRECT` dengan URL kosong (data lama yang rusak) → jatuh ke `ROUTER_PAGE`.
  - `splitIsolirTarget("http://a.b/c/d")` → `{host:"a.b", target:"a.b/c/d"}`.
  - Proxy:
    - `ROUTER_PAGE` → rule billing ber-args `src-address=10.127.0.0/18, action=deny`.
    - `REDIRECT` → `action=redirect, action-data=<target>`.
    - Router lama ber-`redirect` yang dipindah ke `ROUTER_PAGE` di-set menjadi `deny`.
    - Web proxy di-enable di kedua mode, termasuk saat URL kosong.
  - Firewall:
    - `netmanager_allow` = IP server ditambah host isolir hanya untuk `REDIRECT`.
    - Entri lain di list itu (host lama) dihapus saat provisioning.
  - `writeIsolirPageFile`:
    - File belum ada → `/ip/proxy/reset-html`, tunggu file muncul (maks 5 dtk, polling
      `/file/print`), lalu `/file/set =contents=`.
    - File ada dengan isi sama → tidak menulis.
    - Isi beda → `/file/set`.
  - `deprovisionRadius` menghapus seluruh `netmanager_allow` dan proxy access billing, lalu
    mengembalikan `error.html` lewat `/ip/proxy/reset-html`.
  - Call site:
    - Reconfigure meneruskan `IsolirProvisioning` dari router (`isolirMode`, `isolirUrl`,
      `tenantId` ditambahkan ke `buildRouterReconfigureSelect`).
    - Ganti tes lama `"memakai URL milik router / setting global"` dengan tes mode.
- [ ] **Step 2:** Run tes network. Expected: FAIL.
- [ ] **Step 3:** Implementasikan.
  - `/file/set` dengan `=contents=` dipilih karena bekerja di RouterOS v6 maupun v7
    (`/file/add` tidak ada di v6).
  - Setelah provisioning sukses pada mode `ROUTER_PAGE`, pemanggil menyimpan
    `isolirPageHash` dan `isolirPageSyncedAt`, lalu mengosongkan `isolirPageError`. Tambahkan
    metode repository `updateIsolirPageSync(id, {hash, syncedAt, error})`.
- [ ] **Step 4:** Run `npx vitest run tests/modules/network tests/api && npx tsc --noEmit -p .`.
  Expected: PASS.
- [ ] **Step 5:** Commit `feat(isolir): provisioning router per mode halaman isolir`.

### Task 6: Pengiriman ke router saat pengaturan disimpan

**Files:**
- Create: `modules/network/isolir/isolir-push.ts`
- Modify: `modules/network/isolir/IsolirPageService.ts` (sambungkan pengiriman asli)
- Test: `tests/modules/network/isolir-push.test.ts`

**Interfaces:**
- Consumes: `writeIsolirPageFile`, `runProvisioningConnection`, `renderIsolirPage`,
  `resolveIsolirContent`, `updateIsolirPageSync`
- Produces:
  - `type IsolirPushSummary = { total: number; sent: number; skipped: number; failed:
    Array<{ routerId: string; error: string }> }`
  - `pushIsolirPageToTenantRouters(tenantId: string, deps?): Promise<IsolirPushSummary>`

- [ ] **Step 1: Tes gagal.**
  - Hanya router `tenantId` itu dengan `isolirMode=ROUTER_PAGE` yang dikirimi. Router
    tenant lain dan router `REDIRECT` tidak disentuh.
  - Router dengan `isolirPageHash` sama dengan hash baru → `skipped`.
  - Satu router melempar error → tercatat di `failed` dan `isolirPageError`, dan router
    berikutnya tetap dikirimi.
  - Router dikirimi berurutan, satu koneksi per router.
  - Kredensial memakai generated user bila ada, mengikuti `getRouterCredentials` di
    `RouterReconfigureRouteService.ts`. Pindahkan helper itu ke modul bersama bila perlu
    dipakai dua tempat.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementasikan.
  - Dipanggil `void service.push(tenantId).catch(log)` dari `update`, di dalam
    `runAsSystemContext("isolir-push:<tenantId>", ...)`.
  - Pengiriman in-process, tanpa antrean: router yang terlewat karena restart menyusul pada
    Reconfigurasi.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(isolir): kirim halaman isolir ke router tenant saat disimpan`.

### Task 7: Menu admin dan form NAS

**Files:**
- Create: `app/admin/pengaturan/halaman-isolir/page.tsx` (`ensurePermission("isolir_page:read")`)
- Create: `app/admin/pengaturan/halaman-isolir/HalamanIsolirClient.tsx`
- Create: `app/api/admin/isolir-page/status/route.ts` (GET: router tenant mode
  `ROUTER_PAGE` beserta `name`, `synced` (hash = hash terkini), `isolirPageSyncedAt`,
  `isolirPageError`)
- Modify: `lib/menu-config.ts` (child `PENGATURAN.HALAMAN_ISOLIR`, path
  `/admin/pengaturan/halaman-isolir`, icon `HiOutlineNoSymbol`, setelah Logo)
- Modify: `app/admin/pengaturan/page.tsx` (tambahkan `'isolir_page:read'`)
- Modify: `app/admin/network/mikrotik/components/mikrotikRouterForm.tsx`, `lib/validations/mikrotik.ts`,
  `mikrotik-router.mutations.ts` dan mapper/DTO/entity yang membawa `isolirUrl`
- Test: `tests/api/admin/isolir-page-status-route.test.ts`, perluas
  `tests/api/mikrotik-routers-route.test.ts` dan `mikrotik-routers-id-route.test.ts`

**Interfaces:**
- Consumes: API Task 4; `isolirMode` (Task 1)
- Produces: field form `isolirMode: "ROUTER_PAGE" | "REDIRECT"`

- [ ] **Step 1: Tes gagal.**
  - Create/update router dengan `isolirMode:"REDIRECT"` dan `isolirUrl` kosong → 400
    `"URL isolir wajib diisi untuk mode Redirect"`.
  - Tanpa `isolirMode` → tersimpan `ROUTER_PAGE`.
  - Status route hanya mengembalikan router tenant sesi.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementasikan.
  - Form NAS: select "Mode halaman isolir" dengan opsi "Halaman di router (bawaan)" dan
    "Redirect ke URL". Input URL hanya tampil untuk Redirect, dengan label "URL halaman
    isolir".
  - Halaman Pengaturan: form per bagian sesuai tabel field spec bagian 1. Daftar rekening
    bisa ditambah atau dihapus, dengan batas 10.
  - Pratinjau memakai `<iframe srcDoc>` dari `/api/admin/isolir-page/preview`, dengan
    peringatan bila `dropped` tidak kosong ("Logo tidak dimuat karena halaman melebihi 24
    KiB").
  - Tabel status pengiriman dan petunjuk "Router yang gagal akan diperbarui saat
    Reconfigurasi Mikrotik".
- [ ] **Step 4:** Run tes, `npx tsc --noEmit -p .`, dan `npx eslint` pada file yang diubah.
  Expected: PASS.
- [ ] **Step 5:** Commit `feat(isolir): menu Halaman Isolir dan mode di form NAS`.

### Task 8: Verifikasi lab dan rilis

Dikerjakan pengendali (sesi utama), bukan subagent, karena butuh akses lab, Chrome, dan izin
push.

- [ ] **Step 1:** Jalankan seluruh suite: `npx vitest run`, `npx tsc --noEmit -p .`,
  `npx eslint .`. Expected: hijau.
- [ ] **Step 2:** Minta izin pemilik untuk merge dan push ke `main`. Setelah deploy hijau,
  Reconfigurasi ROUTERLAB.
- [ ] **Step 3:** Di Chrome, isi Halaman Isolir tenant lab, simpan, dan pastikan status kirim
  ROUTERLAB "terkirim". Di router, `webproxy/error.html` harus berisi hash yang sama.
- [ ] **Step 4:** Isolir `tes-lab-02`. Dari client lab, `/tool fetch url=http://example.com`
  harus mendapat halaman tenant. Ubah judul di menu, simpan, lalu fetch lagi, dan judul baru
  harus tampil tanpa Reconfigurasi. Aktifkan kembali dan pastikan internet normal.
- [ ] **Step 5:** Ubah ROUTERLAB ke mode Redirect dengan URL uji, lalu Reconfigurasi. Proxy
  access harus `redirect` dan host masuk `netmanager_allow`. Kembalikan ke Halaman di router,
  dan host harus hilang dari list.
