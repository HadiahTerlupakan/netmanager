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
6. **Deprecate** `User.isSales` setelah semua klien memakai `persona`; hapus di
   migration berikutnya (drop column) setelah dilaporkan ke user.

## 4. Kompatibilitas

- Aplikasi lama yang belum mengenal `persona` tetap membaca `isSales` →
  persona sales/teknisi seperti sekarang; staff lama tampil sebagai teknisi
  sampai aplikasi diperbarui.
- `isSalesEfektif` (`modules/presurvei/domain/peran-sales.ts`) diganti menjadi
  turunan `persona === SALES` pada langkah 3.

## 5. Pertanyaan terbuka

- Direktur: apakah butuh aksi (persetujuan) atau murni baca?
- Investor: login lewat aplikasi mobile yang sama, atau portal web saja dulu?
- Finance di mobile: fitur mana yang benar-benar dipakai di lapangan?
