# Design Specification: Persona Pengguna

**Versi**: 1.0
**Tanggal**: 2026-09-26
**Author**: agent
**Status**: Draft — belum diimplementasikan

---

## 1. Latar belakang

Tampilan mobile saat ini dipilih dari dua kolom yang tersebar di `User`:
`employeeType` (selalu `KARYAWAN`) dan `isSales`. Hasilnya hanya empat persona
(`KARYAWAN_SALES`, `KARYAWAN_TEKNISI`, `MITRA_SALES`, `MITRA_TEKNISI`), dan
semua karyawan yang bukan sales jatuh ke tampilan teknisi — termasuk staff
kantor yang tidak pernah memegang work order.

Kebutuhan ke depan: tampilan dan fitur dibedakan per jenis pengguna.

| Persona | Siapa | Inti tampilan |
|---|---|---|
| **Staff** | Karyawan kantor biasa | Absen + fitur pendukung kepegawaian saja |
| **Teknisi** | Lapangan jaringan | Work order, barang, topologi, isolir, (canvasing opsional) |
| **Sales** | Sales & kepala sales | Presurvei, rencana kunjungan, target, penilaian, canvasing |
| **Finance** | Tim keuangan | Tagihan, pembayaran, persetujuan klaim/cashout |
| **Direktur** | Pimpinan | Dashboard eksekutif: kinerja sales, keuangan, jaringan (baca) |
| **Mitra** | Mitra eksternal (sales/teknisi) | Sudah ada — akun & DB terpisah |
| **Investor** | Pemodal | Portal investor: modal, bagi hasil, laporan (baca) |

## 2. Keputusan desain

### 2.1 Dua lapis: jenis akun dan persona karyawan

Mitra dan investor **bukan** user karyawan — mitra punya DB & login sendiri
(`prismaMitra`, `tryMobileMitraLogin`), investor adalah entitas modul investor
(lihat `investor-module-enhancement.md`). Memaksakan mereka ke satu enum di
`User` akan mencampur tiga tabel akun. Karena itu:

```
Jenis akun (dari alur login)   Persona karyawan (dari Role)
───────────────────────────    ───────────────────────────
KARYAWAN  ───────────────────▶ STAFF | TEKNISI | SALES | FINANCE | DIREKTUR
MITRA     (mitraType: SALES/TEKNISI — sudah ada)
INVESTOR  (portal investor — baru)
```

Payload auth mobile mengirim satu nilai gabungan `persona`
(mis. `KARYAWAN_STAFF`, `MITRA_SALES`, `INVESTOR`) supaya aplikasi tetap cukup
membaca satu medan.

### 2.2 Persona karyawan melekat pada Role, bukan User

- `Role.persona: PersonaKaryawan` (enum baru, default `STAFF`).
- Kepala sales = role berpersona `SALES` dengan lingkup rencana TIM — tidak
  perlu persona tersendiri.
- Alasan: satu orang berganti tugas = ganti role, tampilan ikut otomatis; tidak
  ada kolom yang bisa lupa dicentang (akar bug kepala sales tampil sebagai
  teknisi, 2026-09-26).

### 2.2a Persona role = satu-satunya penentu sales (2026-10-02)

Sebelumnya ada **tiga jalan** seseorang dianggap sales: (1) persona role
`SALES`, (2) saklar user "Fitur Sales & Canvassing" (`User.isSales`), dan
(3) role yang memegang izin kepala sales (`presurvei_rencana` tanpa
`view_all`, lewat `isSalesEfektif`). Ketiganya disatukan:

- Aturan tunggal `isSalesDariPersona(persona)` di
  `modules/roles/domain/persona-karyawan.ts`: sales ⇔ `role.persona === SALES`.
- `User.isSales` **tidak dihapus** (dipakai daftar/manajemen sales, target,
  cashout canvasing, peran pelaku presurvei, sesi), tetapi menjadi **turunan
  otomatis** yang tidak bisa diatur manual:
  - buat user / ganti role → dihitung dari persona role terpilih
    (`hitungIsSalesDariRole`); nilai `isSales` dari payload diabaikan
    (validator masih menerimanya, `@deprecated`, demi klien lama);
  - ubah persona role → `User.isSales` seluruh pengguna role itu disinkronkan
    dalam transaksi yang sama (`RoleRepository.update`).
- Izin kepala sales tidak lagi menjadikan seseorang sales. `isSalesEfektif`
  dihapus; `isKepalaSalesDariIzin` tersisa hanya untuk saran di form role
  ("Biasanya dipasangkan dengan tampilan Sales").
- Form user admin: saklar sales dihapus; di bawah pilihan role tampil
  "Tampilan di HP: <persona> (mengikuti role <nama>)" dengan tautan ke Hak Akses.
  Target canvassing/skema target/kepala sales tampil hanya untuk persona Sales.

### 2.3 Persona menentukan kerangka, permission menentukan isi

Persona memilih **Beranda dan tab bawah**. Di dalamnya setiap fitur tetap
digerbang permission (`m_*`) seperti sekarang. Contoh: teknisi dengan
`m_canvasing` tetap melihat canvasing tanpa menjadi sales; staff yang diberi
`m_salary` melihat slip gaji.

### 2.4 Tampilan Staff (baru)

Staff **bukan** teknisi. Beranda staff minimal:

- Kartu absen hari ini (check-in/out) — inti.
- Menu cepat pendukung kepegawaian, masing-masing tetap per permission:
  Izin & Cuti (`m_izin`), Lembur (`m_lembur`), Kalender Libur (`m_holidays`),
  Chat (`m_chat`), Slip gaji (`m_salary`).
- Tab bawah: Beranda · Absensi · Profil (+ Chat bila berizin).
- **Tidak** ada karusel work order, statistik tiket, barang, topologi, isolir.

## 3. Rencana migrasi (multi-step, tanpa data loss)

1. **Tambah skema** — migration `add_persona_to_roles`: enum
   `PersonaKaryawan`, kolom `Role.persona` default `STAFF`.
2. **Backfill** (migration data terpisah, idempoten):
   - role dengan `presurvei_rencana:*` lingkup TIM, atau dipakai user
     `isSales = true` → `SALES`;
   - role dengan izin `m_work_order` → `TEKNISI`;
   - role super admin / berizin `*` → `DIREKTUR` *(tinjau manual)*;
   - sisanya tetap `STAFF`.
   Hasil backfill dilaporkan per tenant untuk ditinjau sebelum dipakai.
3. **Server** — helper tunggal `tentukanPersona(akun)` di `modules/users`;
   login, `/me`, profil mengirim `persona`. `isSales` tetap dikirim (turunan
   `persona === SALES`) untuk aplikasi versi lama.
4. **Admin web** — pilihan persona di form role; badge persona di daftar user.
5. **Mobile** — `Persona` diperluas; `LAYAR_BERANDA: Record<Persona, …>` memaksa
   tiap persona punya layar saat kompilasi. Urutan rilis: Staff → Finance →
   Direktur → Investor. Perlu rilis APK/OTA sesuai `mobile-update-strategy.md`
   (JS-only → OTA cukup).
6. **Satukan penentu sales** — migration data
   `20261001222557_sync_user_is_sales_from_role_persona`: `User.isSales` =
   `role.persona = SALES` (user tanpa role → `false`). Tinjau dulu dengan
   laporan pra-deploy `docs/guides/LAPORAN_PRA_DEPLOY_SYNC_IS_SALES_2026-10-02.md`.
   Sejak langkah ini `isSales` adalah salinan tersinkron, bukan masukan.
7. **Deprecate** `User.isSales` setelah semua klien & query memakai `persona`;
   hapus di migration berikutnya (drop column) setelah dilaporkan ke user.

## 4. Kompatibilitas

- Aplikasi lama yang belum mengenal `persona` tetap membaca `isSales` →
  persona sales/teknisi seperti sekarang; staff lama tampil sebagai teknisi
  sampai aplikasi diperbarui.
- `isSalesEfektif` sudah dihapus (langkah 6); `isSales` yang dikirim ke
  aplikasi = `isSalesDariPersona(role.persona)`.
- Klien lama yang masih mengirim `isSales` di payload user tidak ditolak —
  nilainya diabaikan server.

## 4a. Investor di aplikasi mobile (2026-10-02)

Diputuskan: investor login lewat aplikasi mobile yang sama (portal web tetap ada).

- Login: identitas investor (username/email) dicoba terakhir di rantai login
  mobile; respons `user.role = "INVESTOR"`.
- Token: audience `netmanager-investor-mobile` (`lib/mobile-investor-auth.ts`),
  terpisah dari token karyawan — endpoint karyawan menolaknya. Logout menaikkan
  `Investor.tokenVersion`.
- Data: `/api/mobile/investor/*` (baca saja, dibatasi investor dari sesi).
- Mobile: investor **bukan** `Persona` karyawan; punya grup layar
  `app/(investor)` dan tema sendiri (`PersonaTema = Persona | "INVESTOR"`).
  Tidak memakai realtime.
- Push: token FCM di `Investor.fcmTokens` lewat `/api/mobile/investor/fcm-token`.
  Dikirim untuk modal diterima/ditolak, bagi hasil disetujui, dan uang dikirim
  (`modules/investor/domain/pesan-notifikasi-investor.ts`). Belum ada kotak
  masuk notifikasi investor (tabel `notifications` hanya untuk `User`).
- Endpoint global yang dipanggil aplikasi di semua grup layar (mis. cek versi
  APK) wajib menerima sesi investor; 401 di sana mengeluarkan investor.

## 5. Pertanyaan terbuka

- Direktur & Finance: tampilan sementara = Staff; dirancang satu per satu
  setelah sesi brainstorming (keputusan user 2026-10-02).
