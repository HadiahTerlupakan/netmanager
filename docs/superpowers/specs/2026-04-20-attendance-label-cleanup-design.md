# Attendance Label Cleanup Design

## Tujuan
Merapikan istilah status attendance di UI admin agar tidak lagi menampilkan istilah campuran seperti `Mangkir` atau `Lupa Check-in (Mangkir)` untuk data yang secara canonical sudah dipisah antara `ABSENT` dan `NO_CHECKOUT`.

## Terminologi Canonical
- `ABSENT` ditampilkan sebagai **Tidak Hadir**
- `NO_CHECKOUT` ditampilkan sebagai **Lupa Absen Pulang**

## Ruang Lingkup
Perubahan difokuskan pada surface admin attendance dan helper display yang memasok label status.

Termasuk:
- badge/status label di `app/admin/attendance/AttendanceClient.tsx`
- wording filter/dropdown/CTA yang masih memakai istilah `Mangkir`
- helper kompatibilitas legacy di `lib/attendance-display.ts`
- test yang mengunci istilah canonical baru di UI/display layer

Tidak termasuk:
- perubahan enum database
- perubahan semantics query/filter backend
- migrasi data lama di database

## Pendekatan
Gunakan cleanup pada level UI + helper display.

1. `AttendanceClient.tsx` berhenti hardcode label `Mangkir` untuk status `ABSENT`.
2. `AttendanceClient.tsx` mengganti label campuran `Lupa Check-in (Mangkir)` menjadi label canonical yang sesuai konteks status.
3. `lib/attendance-display.ts` tetap mengenali note legacy seperti `Auto checkout by system (Mangkir)` agar data historis tetap terbaca benar, tetapi output/penamaan yang tampil ke pengguna mengikuti istilah canonical.
4. CTA/admin action seperti `Sync Mangkir` dan prompt backfill diselaraskan ke istilah canonical yang menjelaskan aksi sebenarnya.

## Data Flow
- Backend tetap mengirim status raw seperti sekarang (`ABSENT`, `NO_CHECKOUT`, legacy note lama bila ada).
- Helper display memetakan note/status lama ke klasifikasi display yang benar.
- UI admin hanya menampilkan label canonical dari hasil klasifikasi tersebut.

## Error Handling
Tidak ada perubahan alur error. Cleanup ini hanya mengubah wording presentasi dan mapping display.

## Testing
Tambahkan atau sesuaikan test untuk memastikan:
- `ABSENT` tampil sebagai `Tidak Hadir`
- `NO_CHECKOUT` tampil sebagai `Lupa Absen Pulang`
- note legacy `Auto checkout by system (Mangkir)` tetap dikenali sebagai historical no-checkout
- UI admin tidak lagi merender string `Mangkir` atau `Lupa Check-in (Mangkir)` pada label status canonical

## Risiko dan Mitigasi
- **Risiko:** wording lama masih tersisa di satu surface.
  **Mitigasi:** grep string literal terkait + test targeted pada UI dan display helper.
- **Risiko:** data historis no-checkout jadi salah label.
  **Mitigasi:** pertahankan parser legacy note di helper display.

## Scope Check
Spec ini sengaja sempit: hanya cleanup istilah presentasi tanpa mengubah kontrak data, query backend, atau migrasi database.
