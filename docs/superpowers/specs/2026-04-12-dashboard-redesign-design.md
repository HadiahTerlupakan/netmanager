# Dashboard Redesign Netmanager

**Tanggal:** 2026-04-12  
**Scope:** Admin dashboard, RADIUS dashboard, dan customer dashboard dalam satu gelombang redesign  
**Target utama:** Stabilitas data end-to-end

---

## 1. Latar belakang

Dashboard Netmanager saat ini punya tiga surface utama yang berkembang dengan pola berbeda:

- **Admin dashboard** di `app/admin/*`
- **RADIUS dashboard** di `app/admin/network/radius/*`
- **Customer dashboard** di `app/(customer)/dashboard/*`

Dari audit yang sudah dilakukan, problem utamanya bukan hanya bug terisolasi, tetapi kombinasi dari beberapa hal:

1. **Contract data tidak konsisten** antar endpoint dashboard.
2. **Auth dan permission boundary tersebar** dan tidak selalu seragam.
3. **Data correctness belum kuat**, terutama pada summary yang dibentuk dari source parsial.
4. **Beberapa file/hook terlalu gemuk**, sehingga logic correctness, transport, dan presentation bercampur.
5. **Realtime dan state update** belum cukup terkontrol untuk dashboard yang aktif berubah.

User memilih:
- redesign besar, bukan patch kecil,
- dikerjakan **dalam satu gelombang**,
- boleh mengubah internal, contract internal, dan UI bila membantu stabilitas,
- target utama tetap **stabilitas data**.

Karena belum pasti apakah ada consumer lain di luar UI web untuk sebagian endpoint dashboard, redesign harus tetap agresif pada caller internal web, tetapi **transisinya harus bisa ditrace dan aman**.

---

## 2. Tujuan desain

Redesign ini harus menghasilkan:

1. **Contract dashboard yang konsisten** untuk caller internal web.
2. **Boundary auth dan permission yang lebih tegas** dan seragam.
3. **Source of truth summary yang benar**, terutama untuk billing/customer dan agregasi admin.
4. **Pemisahan concern yang lebih jelas** antara service, contract mapping, hook/page state, dan komponen UI.
5. **Failure mode yang jujur**, sehingga dashboard tidak menampilkan angka atau status menyesatkan saat data gagal dimuat.
6. **Verifikasi lintas dashboard yang kuat**, termasuk test contract, test service, test hook/UI state, dan runtime verification.

---

## 3. Non-goals

Redesign ini **tidak** bertujuan untuk:

1. Mendesain ulang identitas visual besar-besaran tanpa hubungan ke stabilitas data.
2. Mengubah seluruh arsitektur aplikasi di luar area dashboard.
3. Merombak semua endpoint unrelated di luar admin/RADIUS/customer dashboard.
4. Membangun sistem state management baru untuk seluruh aplikasi.
5. Menambahkan fitur dashboard baru yang tidak diperlukan untuk menutup masalah correctness/stability.

---

## 4. Masalah inti yang harus diselesaikan

### 4.1 Admin dashboard

Lokasi utama:
- `app/admin/page.tsx`
- `app/admin/AdminDashboardClient.tsx`
- `app/admin/layout.tsx`
- `modules/admin/services/AdminDashboardPageService.ts`
- `modules/admin/services/DashboardService.ts`
- `modules/admin/services/dashboard-helpers.ts`
- `components/dashboard/DashboardSocketUpdate.tsx`

Masalah inti:
- tenant scoping belum cukup eksplisit pada seluruh jalur agregasi dashboard,
- rule auth/super admin/permission masih tersebar,
- page memegang auth + orchestration + presentasi besar sekaligus,
- realtime invalidation terlalu kasar karena full `router.refresh()`.

### 4.2 RADIUS dashboard

Lokasi utama:
- `app/admin/network/radius/page.tsx`
- `app/admin/network/radius/RadiusDashboard.tsx`
- `app/admin/network/radius/hooks/useRadiusDashboardData.ts`
- `app/api/admin/radius/dashboard/*`
- `app/api/admin/radius/sessions/[username]/history/route.ts`

Masalah inti:
- hook besar memegang terlalu banyak concern,
- fetch utama belum aman terhadap response non-2xx,
- contract UI ↔ API belum cukup eksplisit,
- update realtime dan action flow belum dipisah rapi.

### 4.3 Customer dashboard

Lokasi utama:
- `app/(customer)/dashboard/page.tsx`
- `components/customer/CustomerAuthProvider.tsx`
- `lib/customer-auth.ts`
- `app/api/customer/profile/route.ts`
- `app/api/customer/usage/route.ts`
- `app/api/customer/invoices/route.ts`
- `modules/pelanggan/repositories/CustomerInvoiceRepository.ts`
- `modules/pelanggan/services/CustomerUsageService.ts`

Masalah inti:
- billing summary dibentuk dari source yang tidak cukup kuat,
- response contract antar endpoint customer tidak seragam,
- auth masih client-gated,
- partial failure bisa menghasilkan UI yang tampak valid tetapi datanya misleading.

---

## 5. Arsitektur target

### 5.1 Prinsip umum

Semua dashboard akan bergerak ke pola berikut:

**Data source → dashboard composer/API → view-model mapper → UI**

Artinya:
- repository/service tetap bertanggung jawab pada data domain,
- composer/API bertanggung jawab menyusun kebutuhan dashboard,
- mapper/view-model bertanggung jawab membentuk shape yang stabil untuk UI,
- UI hanya consume data yang sudah siap tampil.

Dengan pola ini, UI tidak lagi:
- menebak-nebak shape response,
- menghitung summary kritis dari data mentah parsial,
- menyimpan logic bisnis yang seharusnya ada di layer lebih bawah.

### 5.2 Contract layer dashboard

Semua endpoint dashboard yang aktif dipakai UI web akan bergerak ke contract yang konsisten.

Targetnya:
- envelope response konsisten,
- success path dan error path terdefinisi jelas,
- caller tidak lagi menggunakan fallback `payload?.data ?? payload` untuk menebak format respons.

Untuk area yang mungkin dipakai consumer lain, transisi dilakukan dengan hati-hati:
- inventaris caller internal web yang terdampak,
- migrasikan seluruh caller internal web ke contract baru dalam gelombang yang sama,
- baru hapus fallback/compatibility lama setelah caller internal tidak lagi memakainya.

### 5.3 Auth dan permission layer

Boundary auth/permission akan dibersihkan agar peran setiap layer jelas:

- **Portal boundary**: memastikan user boleh masuk ke area admin/customer.
- **Feature boundary**: memastikan user boleh melihat dashboard tertentu.
- **Data boundary**: memastikan API/service hanya mengembalikan data yang memang sah untuk context user/tenant.

Target hasil:
- rule super admin tidak tersebar dalam bentuk berbeda-beda,
- redirect/forbidden behavior seragam,
- tenant scoping eksplisit pada jalur yang memang tenant-sensitive.

### 5.4 View-model layer

Setiap dashboard akan punya model presentasi yang lebih tegas.

Tujuannya:
- memisahkan domain payload dari kebutuhan UI,
- mempermudah testing correctness,
- memungkinkan perubahan UI tanpa merusak contract domain,
- menghindari logic transform berserakan di komponen besar.

---

## 6. Desain per dashboard

## 6.1 Admin dashboard

### Target bentuk
Admin dashboard tetap **server-driven** karena datanya bersifat agregat dan banyak bergantung pada server-side auth/context.

Namun struktur internalnya diubah agar lebih jelas:

- page loader bertanggung jawab pada entry point dan access boundary yang relevan,
- composer khusus admin dashboard bertanggung jawab pada seluruh data yang memang dibutuhkan page,
- section UI dipisah berdasarkan concern:
  - hero/overview,
  - KPI blocks,
  - leaderboard,
  - site tables.

### Target perubahan
1. Tenant scoping dibuat eksplisit di jalur agregasi yang memang sensitif tenant.
2. Logika super admin/permission tidak diulang di banyak tempat dengan variasi berbeda.
3. `AdminDashboardClient.tsx` diperkecil tanggung jawabnya.
4. Realtime invalidation dibuat lebih terkontrol; minimal tidak menjadi titik buta yang memicu refresh kasar tanpa guard.

### Hasil yang diinginkan
- data dashboard admin lebih dapat dipercaya,
- boundary akses lebih mudah dipahami,
- page tidak menjadi god-file,
- perubahan berikutnya di satu section tidak memaksa memahami seluruh file besar.

---

## 6.2 RADIUS dashboard

### Target bentuk
RADIUS dashboard tetap **client-driven** karena nature-nya lebih stateful dan interaktif: refresh, history modal, action reset, realtime subscription.

Tetapi hook besar akan dipisah ke beberapa concern logis:

- dashboard fetch state,
- history modal state,
- action/reset state,
- realtime bridge/subscription.

### Target perubahan
1. Semua fetch utama wajib memvalidasi `response.ok` sebelum mengubah state data.
2. Contract stats, recent sessions, dan history dibuat eksplisit dan typed.
3. Error state dipisah per concern agar UI tidak mencampur error history dengan error refresh utama.
4. Realtime update tidak boleh overwrite state tanpa shape yang tervalidasi.
5. Test hook dipindah dari implementation-detail heavy ke behavior-driven coverage yang lebih stabil.

### Hasil yang diinginkan
- dashboard RADIUS tidak lagi diam-diam menerima payload error sebagai data,
- failure path lebih jelas,
- hook lebih mudah diuji,
- evolusi feature seperti history/action tidak membuat satu file makin membengkak.

---

## 6.3 Customer dashboard

### Target bentuk
Customer dashboard tetap boleh berbentuk **client page**, tetapi source summary penting harus dibenahi.

Billing summary, connection summary, dan profile summary harus berasal dari source yang memang sesuai untuk kebutuhan dashboard, bukan sekadar hasil inferensi dari data parsial.

### Target perubahan
1. Billing summary dipindahkan ke source yang benar dan lengkap.
2. Due-date dan outstanding calculation tidak lagi bergantung pada invoice urutan `issueDate` yang bisa menyesatkan.
3. Response contract customer dashboard-related endpoints diseragamkan.
4. Auth failure dan partial failure dibuat eksplisit di UI.
5. Dashboard tidak boleh menampilkan status “aman/lunas/normal” jika data terkait gagal dimuat.

### Hasil yang diinginkan
- angka billing yang tampil benar,
- user tidak mendapat informasi menyesatkan saat ada kegagalan data,
- auth flow customer lebih tegas,
- page dashboard tidak menanggung domain logic yang seharusnya hidup di service/composer.

---

## 7. Error handling

## 7.1 Prinsip

Dashboard harus **fail honestly**, bukan fail quietly.

Artinya:
- response error tidak boleh diperlakukan sebagai data sukses,
- section yang gagal harus terlihat gagal,
- summary tidak boleh dipalsukan dengan nol/default yang terlihat valid,
- auth failure tidak boleh menghasilkan halaman setengah-valid yang membingungkan.

## 7.2 Admin
- invalid auth/permission → redirect/forbidden konsisten,
- section agregat yang gagal harus dikenali dengan jelas,
- tenant mismatch harus fail-closed.

## 7.3 RADIUS
- response non-2xx harus diperlakukan sebagai error flow,
- action error, history error, dan main dashboard error dipisah,
- realtime payload harus dianggap tidak valid sampai lulus shape expectation.

## 7.4 Customer
- profile/usage/invoice failure tidak boleh disamarkan menjadi nilai normal,
- mid-session auth failure harus memicu state auth yang eksplisit,
- billing summary tidak boleh fallback ke hasil yang misleading.

---

## 8. Testing strategy

Redesign ini harus diverifikasi pada empat level.

### 8.1 Contract tests
Untuk memastikan response dashboard dan mapper konsisten.

Cakupan target:
- envelope response dashboard,
- shape data view-model,
- failure payload shape yang dipakai UI.

### 8.2 Service/composer tests
Untuk memastikan correctness di level bisnis.

Cakupan target:
- admin tenant scoping,
- admin dashboard composition,
- RADIUS shaping logic,
- customer billing summary correctness,
- customer connection summary correctness.

### 8.3 Hook / UI-state tests
Untuk memastikan state transition UI benar.

Cakupan target:
- RADIUS fetch lifecycle,
- RADIUS history flow,
- RADIUS reset/action flow,
- customer partial failure state,
- admin branching penting bila masih ada decision logic di render path.

### 8.4 Runtime verification
Untuk memastikan hasil akhirnya benar-benar usable.

Verifikasi target:
- buka `/admin`,
- buka `/admin/network/radius`,
- buka dashboard customer,
- cek golden path,
- cek failure path penting,
- cek tidak ada summary misleading setelah error/failure yang sengaja disimulasikan.

---

## 9. Strategi migrasi satu gelombang

Karena user memilih **satu gelombang**, eksekusi desain akan tetap dilakukan dalam satu inisiatif, tetapi secara internal dibagi ke urutan yang aman.

### Phase A — Fondasi bersama
- definisikan contract dashboard yang konsisten,
- rapikan auth/permission helper yang menjadi sumber kebenaran,
- definisikan mapper/view-model yang akan dipakai caller baru.

### Phase B — Admin dan RADIUS
- migrasikan admin dashboard ke flow yang lebih eksplisit,
- migrasikan RADIUS dashboard ke contract + state model baru,
- rapikan route/controller yang terlalu gemuk bila menghambat stabilitas.

### Phase C — Customer
- pindahkan billing summary ke source yang benar,
- seragamkan contract customer dashboard endpoints,
- rapikan auth/error flow customer dashboard.

### Phase D — Cleanup
- hapus fallback parsing yang rapuh,
- hapus logic lama yang tidak lagi dipakai caller web internal,
- sisakan jalur yang benar-benar menjadi sumber kebenaran baru.

---

## 10. Risiko dan mitigasi

### Risiko 1 — Blast radius besar
Karena redesign mencakup tiga dashboard, risiko regresi meningkat.

**Mitigasi:**
- lakukan lewat composer/mapper/contract yang eksplisit,
- tambah test contract dan service lebih dulu,
- verifikasi runtime untuk semua dashboard sebelum claim selesai.

### Risiko 2 — Consumer lain mungkin ada
Belum ada kepastian apakah sebagian endpoint dipakai di luar UI web.

**Mitigasi:**
- inventaris caller internal yang aktif,
- lakukan migrasi caller internal serentak,
- hindari penghapusan contract lama sebelum jejak pemakaian internal jelas.

### Risiko 3 — Refactor melebar ke luar scope
Redesign besar rawan berubah jadi refactor umum.

**Mitigasi:**
- semua perubahan harus tetap terkait langsung ke stabilitas data dashboard,
- hindari merombak modul unrelated,
- tidak menambah fitur baru yang tidak dibutuhkan.

---

## 11. Keputusan desain final

Keputusan final untuk implementasi berikutnya:

1. **Gunakan redesign besar satu gelombang**.
2. **Prioritaskan stabilitas data**, bukan polish visual sebagai tujuan utama.
3. **Standarkan contract dashboard** untuk caller internal web.
4. **Rapikan boundary auth/permission** agar konsisten.
5. **Pindahkan summary kritis ke source yang benar**, terutama pada customer billing.
6. **Pisahkan concern** pada admin page besar dan hook RADIUS besar bila memang itu syarat agar correctness lebih aman.
7. **Verifikasi lewat test + runtime**, bukan hanya perubahan kode.

---

## 12. Implementasi yang diharapkan setelah spec ini

Plan implementasi berikutnya harus menghasilkan urutan kerja yang mencakup:

- fondasi contract/auth/view-model,
- perubahan admin dashboard,
- perubahan RADIUS dashboard,
- perubahan customer dashboard,
- test contract/service/hook,
- runtime verification end-to-end.
