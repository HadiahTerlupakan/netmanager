# Attendance Bulk Delete and Page Size Design

## Ringkasan
Halaman admin Data Absensi akan mendukung pemilihan banyak baris pada tabel yang sedang tampil, lalu menghapusnya sekaligus melalui endpoint bulk delete baru. Pada saat yang sama, halaman akan menambah kontrol jumlah data per halaman dengan opsi 10, 20, 30, 40, 50, dan 100.

## Tujuan
- Memungkinkan admin menghapus beberapa data absensi yang dipilih dalam satu aksi.
- Menjaga perilaku hapus tetap konsisten dengan aturan akses `attendance:delete`, `attendance:site_only`, dan `attendance:department_only`.
- Memberi fleksibilitas jumlah data yang ditampilkan per halaman tanpa mengubah perilaku filter yang ada.

## Non-Tujuan
- Tidak menambah pemilihan lintas semua halaman hasil filter.
- Tidak mengubah skema database attendance.
- Tidak menambah soft delete atau restore flow.
- Tidak mengubah logika filter, export, atau edit attendance di luar kebutuhan reset selection.

## Desain UI
Perubahan utama dilakukan di `app/admin/attendance/AttendanceClient.tsx`.

### Selection tabel
- Tambah checkbox per baris attendance.
- Tambah checkbox header untuk memilih semua baris pada halaman aktif.
- State selection disimpan sebagai kumpulan `attendance.id` yang sedang tampil dan dipilih.
- Selection hanya berlaku untuk data yang sedang dimuat pada tabel saat ini.

### Aksi bulk delete
- Tambah tombol `Hapus Terpilih` pada area action/filter.
- Tombol hanya tampil atau aktif saat ada minimal satu item terpilih dan user memiliki permission `attendance:delete`.
- Saat diklik, tampilkan dialog konfirmasi dengan jumlah item yang akan dihapus.
- Saat request berjalan, tombol aksi dinonaktifkan agar tidak terjadi double submit.
- Setelah sukses, selection di-reset dan data dimuat ulang.

### Jumlah data per halaman
- Tambah dropdown page size dengan opsi `10, 20, 30, 40, 50, 100`.
- Nilai page size dipakai pada request daftar attendance sebagai parameter `limit`.
- Saat page size berubah, halaman di-reset ke page 1 lalu data dimuat ulang.
- Saat page size berubah, selection di-reset agar tidak ada ID lama yang tertinggal.

## Desain API
Perubahan backend dilakukan di `app/api/admin/attendance/route.ts` dengan menambah handler bulk delete baru.

### Request
- Method: `DELETE`
- Body: `{ ids: string[] }`
- Validasi:
  - `ids` wajib ada.
  - `ids` harus array non-kosong.
  - Setiap item harus lolos validasi ID attendance.
  - ID duplikat dibersihkan sebelum proses hapus.

### Otorisasi dan cakupan data
- Endpoint mewajibkan permission `attendance:delete`.
- Jika user bukan super admin, filtering data yang boleh dihapus mengikuti pola akses yang sudah dipakai pada delete tunggal:
  - `attendance:site_only`
  - `attendance:department_only`
- Server hanya memproses attendance yang benar-benar berada dalam cakupan akses user.

### Eksekusi hapus
- Server mencari semua attendance berdasarkan daftar ID yang diminta.
- Server menyaring record yang valid dan boleh dihapus.
- Server menghapus record yang lolos penyaringan dalam satu operasi bulk.
- Aktivitas delete tetap dicatat melalui logging aktivitas, dengan detail daftar ID yang terhapus dan jumlahnya.

### Response
Response sukses mengembalikan ringkasan hasil agar frontend bisa menampilkan toast yang akurat, misalnya:
- `requestedCount`
- `deletedCount`
- `deletedIds`
- `skippedCount`

Dengan bentuk ini, frontend dapat menampilkan hasil seperti “5 data absensi berhasil dihapus” atau “3 data dihapus, 2 dilewati”.

## State dan alur data frontend
- `fetchAttendances` membaca nilai `page` dan `limit` aktif.
- Setelah data attendance berubah karena fetch baru, selection yang tidak relevan dibersihkan.
- Selection di-reset penuh saat filter, search, page, atau limit berubah untuk menjaga kesesuaian visual dengan data yang tampil.
- Bulk delete mengirim hanya `ids` yang sedang dipilih.
- Setelah respons sukses, frontend menutup dialog konfirmasi, mengosongkan selection, lalu memanggil fetch ulang.

## Error handling
- Jika tidak ada item terpilih, aksi bulk delete tidak bisa dijalankan dari UI.
- Jika body request tidak valid, API mengembalikan bad request.
- Jika user tidak memiliki permission, API mengembalikan forbidden.
- Jika sebagian ID tidak ditemukan atau berada di luar cakupan akses user, ID tersebut tidak dihapus dan dihitung sebagai skipped.
- Frontend menampilkan pesan sukses parsial atau gagal sesuai ringkasan respons/error.

## Testing
### API
Tambah test untuk bulk delete route yang mencakup:
- reject tanpa permission `attendance:delete`
- reject body `ids` yang kosong atau tidak valid
- hanya menghapus data dalam cakupan site/departemen user
- mengembalikan ringkasan `requestedCount`, `deletedCount`, dan `skippedCount`

### Frontend
Tambah test untuk logic UI attendance yang mencakup:
- memilih satu baris
- memilih semua baris pada halaman aktif
- reset selection saat page berubah
- reset selection saat limit berubah
- request bulk delete mengirim hanya ID yang dipilih
- perubahan page size memakai limit 10/20/30/40/50/100

### Verifikasi manual
- pilih satu item lalu hapus
- pilih beberapa item lalu hapus
- pilih semua item pada halaman aktif lalu hapus
- ubah page size ke 20, 30, 40, 50, 100 lalu pastikan pagination tetap benar
- ubah filter/search/page/limit dan pastikan selection ter-reset

## Keputusan desain
Menggunakan endpoint bulk delete khusus lebih baik daripada loop delete per item dari frontend karena:
- lebih konsisten untuk otorisasi server-side
- lebih efisien untuk banyak item
- lebih mudah memberi hasil sukses parsial atau penuh dalam satu respons
- lebih mudah diuji tanpa bergantung pada banyak request berurutan
