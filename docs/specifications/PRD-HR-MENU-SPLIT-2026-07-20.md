# PRD: Menu HR — Pisah Fungsi Kepegawaian dari Menu Karyawan (`/admin/users`)

| Field | Value |
|-------|-------|
| **ID** | `PRD-HR-MENU-SPLIT-2026-07-20` |
| **Tanggal** | 2026-07-20 |
| **Author** | agent |
| **Status** | Implemented (Fase 1) — menunggu commit/push user |
| **Revisi** | v1 salah fokusus (menggabungkan Kehadiran+Gaji). **v2 = pisah isi dari Karyawan ke menu HR baru** |
| **Tipe SOT** | `[ADDED]` (menu + surface HR) + `[CHANGED]` (halaman Karyawan dipersempit) + `[DOCS]` |
| **Scope** | `lib/menu-config.ts`, `app/admin/hr/**`, `app/admin/users/**` (kurangi section HR), reuse API `modules/users` + leave-balance existing, test UI, `docs/CHANGELOG.md` |
| **Related** | [admin-users-refactor-prd.md](./admin-users-refactor-prd.md) (refactor teknis users — scope terpisah), [menu-configuration.md](../guides/menu-configuration.md) |
| **SOT keputusan** | File PRD ini |
| **SOT implementasi** | `docs/CHANGELOG.md` → `[Unreleased]` (setelah kode selesai per fase) |
| **Commit / push** | **DILARANG** sampai user minta eksplisit |

---

## 0. Intent yang Benar (koreksi v1)

### Yang user minta

> Tambah **1 menu HR** dengan **memisahkan beberapa fungsi dari menu Karyawan** (`admin/users`).

Bukan: menggabungkan Kehadiran + Penggajian di bawah payung HR (itu kesalahan PRD v1).

### Ringkas

| Domain | Menu | Isi |
|--------|------|-----|
| **Akun / IAM** | **Karyawan** (atau rename **Pengguna**) — tetap `/admin/users` | Identitas login, role, password, status aktif, force logout, flag sales |
| **Kepegawaian / HR** | **HR** — menu **baru** | Data organisasi & aturan kerja pegawai yang **sekarang menempel** di detail user |

**Kehadiran** dan **Penggajian** tetap top-level seperti sekarang (tidak dipindah ke HR di PRD ini), kecuali nanti ada keputusan produk terpisah.

---

## 1. Source of Truth (SOT)

Sesuai `CLAUDE.md` § SOT & Changelog:

| Artefak | Peran |
|---------|--------|
| **PRD ini** | SOT **apa yang dipisah** (daftar section/fungsi), fase, non-tujuan |
| **`docs/CHANGELOG.md` `[Unreleased]`** | SOT **perubahan kode yang sudah live** — tulis **setelah** fase selesai |
| **`lib/menu-config.ts`** | SOT struktur sidebar/CommandPalette |
| **Path URL** | Fase 1 boleh **tambah** path HR baru; path `/admin/users` **tetap** untuk IAM |
| **API / Prisma** | Fase 1: **reuse** existing; **tidak** migration kecuali disepakati terpisah |

### Changelog

- Satu entry per fase selesai.
- Format entry standar project (`Tipe`, `Scope`, `Author`, `Deskripsi`, `Files`, `Breaking`).
- Entry `[DOCS]` untuk koreksi PRD boleh; implementasi kode = entry terpisah `[ADDED]`/`[CHANGED]`.
- **Tidak** commit/push tanpa perintah user.

### Self-check penutup fase

- [ ] Threshold SOT terpenuhi?
- [ ] Changelog `[Unreleased]` diisi?
- [ ] Breaking ditandai jika ada?
- [ ] Tidak ada migration tak terdokumentasi?
- [ ] Tidak commit/push otomatis?

---

## 2. Latar Belakang

### 2.1 Masalah di `/admin/users` hari ini

Halaman list + detail Karyawan mencampur **dua tanggung jawab**:

| Section di detail user | Domain | File utama |
|------------------------|--------|------------|
| Email, password, role, nama, telepon | **IAM / Akun** | `UsersDetailClient` form |
| Status aktif | **IAM** | `StatusAndSalesSection` |
| Fitur Sales + target canvassing | **Sales** (bukan HR) | `StatusAndSalesSection` |
| Departemen + multi-site | **HR** | `OrganizationSection` |
| Jam kerja (FIXED / SHIFT / FLEXIBLE) | **HR** | `WorkingHoursSettings` |
| Kuota cuti / leave balance | **HR** | `LeaveBalanceSettings`, `LeaveQuotaSummary` |
| Stats performa WO / sales | **Ops / Sales** | `UserPerformanceStats`, `SalesPerformanceStats` |

Akibatnya:

1. HRD harus masuk menu “Karyawan” yang terasa seperti admin user IT.
2. IT Admin diganggu field jam kerja & kuota cuti saat cuma mau ganti role/password.
3. Tidak ada **entry point HR** di sidebar untuk master data kepegawaian.

### 2.2 Yang **tidak** diubah oleh PRD ini

- Menu top-level **Kehadiran** (absensi, shift, lembur, izin, libur, live map).
- Menu top-level **Penggajian**.
- Menu **Mitra** / **Investor**.
- Backend entity `User` tunggal (login = employee master) — **tidak** pecah ke tabel `Employee` di fase 1.
- Kontrak API mobile yang mengandalkan `/api/admin/users` (kecuali penambahan endpoint opsional yang non-breaking).

---

## 3. Tujuan & Non-Tujuan

### 3.1 Tujuan

| # | Tujuan | Success criteria |
|---|--------|------------------|
| T1 | Ada menu sidebar **HR** | Item `HR` di section SDM |
| T2 | Fungsi kepegawaian **dipisah** dari alur utama Karyawan | Section HR tidak lagi jadi bagian wajib gulungan form edit akun |
| T3 | Karyawan fokusus IAM | List + detail edit fokusus akun: kredensial, role, status, (sales) |
| T4 | Data HR tetap satu sumber | Masih `User` + API existing; UI HR hanya **surface** baru |
| T5 | Deep link IAM tidak putus | `/admin/users` & `/admin/users/[id]` tetap untuk akun |
| T6 | Permission tidak bocor | Akses HR surface tetap gate `users:read` / `users:update` (atau permission yang sama dengan section yang dipindah) di fase 1 |

### 3.2 Non-Tujuan

- ❌ Menggabungkan Kehadiran + Gaji di bawah parent HR (salah v1).
- ❌ Entity `Employee` + migration Prisma di fase 1.
- ❌ Permission resource baru `hr:*` **wajib** di fase 1 (opsional fase 2 jika role HRD ≠ IT).
- ❌ Nested sidebar 3-level.
- ❌ Memindah Sales flags ke menu Marketing (boleh backlog terpisah).
- ❌ Rewrite seluruh `modules/users`.
- ❌ Commit/push tanpa instruksi user.

---

## 4. Pemetaan: apa pindah vs apa tetap

### 4.1 TETAP di menu **Karyawan** (`USERS` → label UI boleh “Pengguna” / “Karyawan”)

| Fungsi | Alasan |
|--------|--------|
| List user (cari, filter aktif/nonaktif, stats) | Master akun |
| Create user (email, password, role, nama, telepon) | IAM onboarding |
| Edit: email, password, role | IAM |
| Edit: `isActive` | IAM |
| Force logout | IAM |
| Flag sales + target canvassing | Sales (bukan HR) — **tetap di sini** sampai PRD Marketing |
| Link/navigasi “Kelola data kepegawaian” → surface HR | Bridge UX |

### 4.2 PINDAH / DIEKSPOS di menu **HR** (diambil dari detail Karyawan)

| Fungsi | Source saat ini | Surface target HR |
|--------|-----------------|-------------------|
| Departemen | `OrganizationSection` | Form kepegawaian HR |
| Multi-site (primary + secondary) | `OrganizationSection` / `MultiSiteSelect` | Form kepegawaian HR |
| Jam kerja (mode, jam, hari, flexible target) | `WorkingHoursSettings` | Form / tab kepegawaian HR |
| Kuota cuti (edit) | `LeaveBalanceSettings` | Form / tab kepegawaian HR |
| Ringkasan kuota cuti (view) | `LeaveQuotaSummary` | View kepegawaian HR |

### 4.3 TIDAK pindah ke HR (tetap di detail user atau modul lain)

| Fungsi | Tempat |
|--------|--------|
| UserPerformanceStats (WO) | Ops — boleh tetap di view profil user atau dihilangkan dari form edit; **bukan** menu HR |
| SalesPerformanceStats | Sales / detail user |
| Kehadiran absensi harian, approve izin, shift roster global, hari libur nasional | Menu **Kehadiran** existing |
| Payroll run, komponen gaji | Menu **Penggajian** existing |

### 4.4 Diagram alur target

```
Sidebar SDM
├── Karyawan (/admin/users)          ← IAM: list, create, edit akun
│     └── detail [id]                ← form akun saja
│           └── CTA "Data kepegawaian" → /admin/hr/employees/[id]
│
├── HR (/admin/hr)                   ← BARU
│     ├── Daftar Pegawai             ← list pegawai (HR view) → detail kepegawaian
│     └── (opsional) deep link only /admin/hr/employees/[id]
│
├── Kehadiran (...)                  ← TIDAK dipindah
├── Penggajian (...)                 ← TIDAK dipindah
├── Mitra / Investor
```

---

## 5. Keputusan produk (v2)

| # | Keputusan | Nilai | Alasan |
|---|-----------|-------|--------|
| D1 | Fokus | **Pisah isi Karyawan → menu HR** | Intent user asli |
| D2 | Kehadiran / Gaji | **Tetap top-level** | Bukan yang diminta dipisah dari Karyawan |
| D3 | Label parent baru | **HR** | Jelas |
| D4 | Label menu users | **Karyawan** tetap **atau** rename **Pengguna** | Default PRD: rename display name → **Pengguna** (code `USERS` tetap) agar beda dari “pegawai HR” |
| D5 | Data model | Satu `User` | Tidak migration fase 1 |
| D6 | API | Reuse `GET/PATCH /api/admin/users/[id]` + leave-balance existing | Thin UI baru |
| D7 | Permission fase 1 | Reuse `users:read` / `users:update` (+ leave permission existing untuk kuota jika sudah beda) | Tidak seed permission baru dulu |
| D8 | Sales | Tetap di Pengguna | Bukan HR |
| D9 | Git | Tidak commit/push otomatis | Instruksi user |

### Default UI label (boleh diubah sebelum eksekusi)

| Code | Name (display) |
|------|----------------|
| `USERS` | Pengguna |
| `HR` | HR |
| `HR.EMPLOYEES` | Data Pegawai (list) |
| path detail | `/admin/hr/employees/[id]` |

> **Permission code:** child list pakai code yang map ke `users` — **jangan** `HR.EMPLOYEES` tanpa special mapping.  
> **SOT mapping:**  
> - Parent `HR` — container, skip check jika ada child.  
> - List/detail HR: code **`USERS`** dipindah? **Tidak** — `USERS` tetap di menu Pengguna.  
> - Child HR list: code **`HR.EMPLOYEES`** → **wajib** special map ke `users` di `getPermissionResource`, **atau** gunakan code yang last-segment-nya valid.  
> **Rekomendasi aman:** child code `HR.USERS_HR` special-mapped ke `users`, atau cukup **satu item** `HR` path `/admin/hr` tanpa child dulu, permission parent di-skip… Parent leaf butuh permission: map `HR` → special `users` **atau** path landing + child dengan special map.  
> **Keputusan teknis D10:**  
> ```
> specialMappings: { "HR": "users", "HR.EMPLOYEES": "users" }
> ```
> di `adminSidebarMenu.ts` agar tidak minta `hr:read` / `employees:read` yang belum ada.

---

## 6. Desain surface HR

### 6.1 Menu config target

```
section: "SDM"
├── USERS          name: "Pengguna"     path: /admin/users      featureModule: users
├── HR             name: "HR"           path: /admin/hr         (tanpa featureModule parent)
│   children:
│     HR.EMPLOYEES name: "Data Pegawai" path: /admin/hr/employees  featureModule: users
├── MITRA          (tetap)
├── INVESTORS      (tetap)
├── KEHADIRAN      (tetap — tidak digabung)
└── SALARY         (tetap — tidak digabung)
```

### 6.2 Halaman

| Path | Fungsi |
|------|--------|
| `/admin/hr` | Landing opsional: card “Data Pegawai”, shortcut ke Kehadiran/Gaji (link only, **bukan** memindah menu) |
| `/admin/hr/employees` | List pegawai (HR-oriented columns: nama, dept, site, mode jam kerja; **bukan** fokusus role/password) |
| `/admin/hr/employees/[id]` | Edit/view **hanya** section HR (organisasi, jam kerja, kuota cuti) |

### 6.3 Perubahan di `/admin/users/[id]`

| Mode | Perilaku target |
|------|-----------------|
| Edit akun | **Hapus/sembunyikan** `OrganizationSection`, `WorkingHoursSettings`, `LeaveBalanceSettings` dari form utama |
| View profil | Section HR diganti **ringkas + link** “Kelola di HR” **atau** ringkasan read-only + CTA |
| Create user (`/admin/users/new`) | Boleh tetap set dept/site minimal agar user usable — **keputusan D11 default:** create tetap boleh isi dept/site (onboarding); jam kerja & kuota cuti **hanya** di HR setelah user ada |

### 6.4 Implementasi UI (prinsip)

- **Extract** komponen existing ke shared (mis. `components/hr/` atau `app/admin/hr/_components/`) — **jangan** duplikasi 200 baris.
- Page HR = thin client; call API yang sama (`updateAdminUser`, leave-balance).
- Tidak taruh business logic di `app/api` baru.
- Ikuti Clean Architecture: UI → API route existing → `modules/users` / leave services.

### 6.5 Kolom list HR vs list Pengguna

| List Pengguna | List HR Data Pegawai |
|---------------|----------------------|
| Email, role, aktif, tenant | Nama, departemen, site(s), mode jam kerja, sisa cuti (jika murah) |
| Aksi: edit akun, force logout | Aksi: kelola kepegawaian |
| Boleh link silang ke HR detail | Boleh link silang ke akun Pengguna |

Reuse fetch list `/api/admin/users` di fase 1 (query sama); beda **kolom & aksi UI** saja.

---

## 7. Fase implementasi

### Fase 0 — PRD (ini) 

- Status Draft v2.
- Tidak ada kode aplikasi sampai user: **implement / eksekusi**.

### Fase 1 — Menu + surface HR + kurangi form Pengguna (inti intent)

| Langkah | Isi |
|---------|-----|
| 1.1 | Tambah menu `HR` + child Data Pegawai di `lib/menu-config.ts` |
| 1.2 | Special mapping permission `HR` / `HR.EMPLOYEES` → `users` |
| 1.3 | Halaman list `/admin/hr/employees` |
| 1.4 | Halaman detail `/admin/hr/employees/[id]` (organisasi + jam kerja + kuota) — **pindahkan/reuse** komponen dari users |
| 1.5 | Landing `/admin/hr` (opsional tapi disarankan) |
| 1.6 | Edit `UsersDetailClient`: cabut section HR; ganti CTA ke HR |
| 1.7 | View mode: CTA / ringkas |
| 1.8 | Test + manual QA |
| 1.9 | Changelog `[ADDED]` + `[CHANGED]` |
| 1.10 | **STOP** — tidak commit/push |

**Acceptance Fase 1:**

1. Sidebar ada **HR → Data Pegawai**.
2. Dari HR bisa ubah dept/site/jam kerja/kuota cuti; data tersimpan (API existing).
3. Form edit **Pengguna** tidak lagi menampilkan jam kerja & kuota cuti (dan dept/site di edit — sesuai D11: dept/site pindah ke HR juga di **edit**; create boleh tetap).
4. Kehadiran & Penggajian **masih** top-level terpisah.
5. User tanpa `users:read` tidak lihat menu HR employees.
6. Tidak ada migration Prisma.
7. Changelog terisi; git tidak di-push.

### Fase 2 — (opsional, go terpisah)

| Item | Kapan |
|------|--------|
| Permission `hr:*` terpisah dari `users:*` | Role HRD tidak boleh ganti password |
| Kolom HR-only di API list (DTO ramping) | Performa / kontrak jelas |
| Pindah Sales ke Marketing | PRD lain |
| Tab di satu URL vs dua app path | Hanya jika UX butuh merge kembali |

---

## 8. Kepatuhan CLAUDE.md

| Aturan | Penerapan |
|--------|-----------|
| Pisah tanggung jawab | Pengguna = IAM UI; HR = kepegawaian UI |
| Thin API route | Tidak menambah fat controller; reuse route users/leave |
| Auth di `lib/rbac` | Gate page HR dengan permission users (fase 1) |
| Minimal impact | Extract komponen, jangan rewrite module |
| Tidak god page | Detail HR hanya section kepegawaian |
| SOT changelog | Wajib setelah fase 1 |
| Prisma policy | Tidak sentuh schema fase 1 |
| Branch/worktree | Tidak buat branch tanpa instruksi |

---

## 9. User stories

### US-1 — HRD kelola kepegawaian
> Sebagai HRD, saya membuka menu **HR → Data Pegawai**, memilih orang, mengatur departemen, site, jam kerja, dan kuota cuti — tanpa form ganti password/role.

### US-2 — IT kelola akun
> Sebagai IT Admin, saya membuka **Pengguna**, mengatur email/role/password/status — tanpa diganggu form jam kerja panjang.

### US-3 — Onboarding
> Saat user baru dibuat di Pengguna, saya masih bisa set dept/site awal; pengaturan jam kerja & cuti dilanjutkan di HR.

### US-4 — Silang navigasi
> Dari detail Pengguna ada tautan ke data kepegawaian HR; dari HR ada tautan ke akun Pengguna.

---

## 10. Risiko & mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Duplikasi form HR vs users | Extract shared components; single source component |
| Permission `HR.EMPLOYEES` → resource salah | Special map ke `users` (D10) |
| HRD kehilangan akses dept di edit user | CTA jelas + menu HR; onboarding create tetap isi dept |
| Scope meluas ke absensi/gaji | Non-tujuan tegas; QA cek sidebar Kehadiran/Gaji tetap |
| Konflik dengan admin-users-refactor-prd | Koordinasi: extract shared dulu; jangan double-edit file sama tanpa urutan |

---

## 11. Testing

### Unit / component

- Menu: `HR` + child muncul; permission `users:read` required via mapping.
- Filter feature `users` off → child HR employees hilang.

### Manual QA

1. Edit jam kerja dari `/admin/hr/employees/[id]` → refresh → nilai sama.
2. Edit kuota cuti dari HR → ringkasan update.
3. Edit role dari `/admin/users/[id]` → tidak perlu buka section jam kerja.
4. Create user dengan dept → muncul di list HR.
5. Kehadiran & Gaji masih di sidebar top-level.

---

## 12. File checklist (Fase 1)

- [ ] `lib/menu-config.ts` — item `HR` + child; rename display `USERS` → Pengguna (opsional)
- [ ] `components/layout/admin-sidebar/adminSidebarMenu.ts` — specialMappings `HR`, `HR.EMPLOYEES` → `users`
- [ ] `app/admin/hr/page.tsx` — landing
- [ ] `app/admin/hr/employees/page.tsx` + client list
- [ ] `app/admin/hr/employees/[id]/page.tsx` + client detail HR
- [ ] Shared components (extract dari `UserFormSections`, `WorkingHoursSettings`, `LeaveBalanceSettings`)
- [ ] `app/admin/users/[id]/UsersDetailClient.tsx` — cabut section HR + CTA
- [ ] `app/admin/users/[id]/UsersDetailView.tsx` — penyesuaian view
- [ ] Tests menu + smoke UI
- [ ] `docs/CHANGELOG.md`
- [ ] `docs/guides/menu-configuration.md` (cuplikan jika perlu)

**Tidak disentuh fase 1:** `prisma/`, `modules/salary`, tree `app/admin/kehadiran` (kecuali link), seed permission massal.

---

## 13. Definition of Done — Fase 1

1. Intent terpenuhi: **fungsi kepegawaian terpisah dari alur utama Karyawan/Pengguna**, ada menu HR.
2. Acceptance §7 Fase 1 lulus.
3. Changelog `[Unreleased]` akurat.
4. Tidak migration; tidak commit/push otomatis.
5. Status PRD → `Implemented (Fase 1)` setelah kode + QA.

---

## 14. Urutan kerja setelah “implement”

1. Status PRD → In Progress.
2. Todo di `tasks/todo.md` dari §12.
3. Special mapping permission → menu → extract komponen → page HR → kurangi form users → test → changelog.
4. Laporan hasil; **tunggu** instruksi commit/push.

---

## 15. Open items (default sudah dipilih)

| Item | Default v2 | Ubah sebelum eksekusi? |
|------|------------|-------------------------|
| Rename label `USERS` → “Pengguna” | Ya | Boleh tetap “Karyawan” |
| Dept/site di create user | Tetap boleh | — |
| Dept/site di edit user | Pindah ke HR | — |
| Landing `/admin/hr` | Ya | Boleh skip |
| Stats WO di view user | Tetap di view | Boleh dihilangkan nanti |

---

## 16. Riwayat

| Tanggal | Versi | Catatan |
|---------|-------|---------|
| 2026-07-20 | v1 | **Dibatalkan arahnya** — salah fokusus flatten Kehadiran+Gaji |
| 2026-07-20 | **v2** | Dikoreksi: menu HR = **pisah fungsi kepegawaian dari Karyawan**; Kehadiran/Gaji tetap |
| 2026-07-20 | Fase 1 impl | Landing `/admin/hr`, list/detail Data Pegawai, strip form Pengguna, menu+permission; status → Implemented (Fase 1) — menunggu commit/push user |

---

*SOT keputusan fitur ini: PRD v2. Implementasi mengikuti §4–§7; changelog adalah SOT kode yang sudah berubah.*
