# Desain Koreksi Manual Lupa Absen pada Attendance

Tanggal: 2026-04-19
Status: Draft disetujui secara percakapan, menunggu review file

## 1. Latar Belakang

Istilah status absensi saat ini bercampur antara istilah bisnis dan istilah teknis. Untuk menyederhanakan perilaku sistem, desain ini menetapkan bahwa tidak ada istilah operasional "lupa check-in" pada alur absensi normal. Jika karyawan tidak melakukan check-in dalam window yang sah, maka hasil otomatisnya adalah mangkir / bolos. Jika ternyata secara fakta karyawan benar-benar masuk kerja, maka perbaikannya dilakukan melalui koreksi manual oleh admin, bukan melalui aplikasi mobile.

## 2. Tujuan

- Menegaskan bahwa tidak check-in berarti mangkir.
- Menjadikan "lupa check-in" sebagai alasan koreksi manual admin, bukan status absensi.
- Memisahkan dengan tegas kasus mangkir dan lupa check-out.
- Menambahkan alur koreksi manual admin yang aman, terdokumentasi, dan punya audit trail.
- Menjaga agar report, payroll, dan histori tetap konsisten.

## 3. Definisi Bisnis Final

### 3.1 Mangkir / bolos
Mangkir terjadi jika karyawan tidak memiliki check-in yang sah sampai batas akhir window check-in untuk hari kerja atau shift yang berlaku.

### 3.2 Lupa check-out
Lupa check-out terjadi jika karyawan sudah check-in, tetapi tidak memiliki check-out sampai batas auto check-out. Ini bukan mangkir. Status finalnya tetap dipisahkan sebagai `NO_CHECKOUT`.

### 3.3 Lupa check-in / lupa absen masuk
Istilah ini tidak dipakai sebagai status sistem. Jika karyawan tidak check-in, sistem tetap menganggap mangkir. Jika kemudian diketahui bahwa karyawan sebenarnya masuk kerja, maka kasus itu ditangani sebagai koreksi manual admin.

## 4. Aturan Window Absensi

### 4.1 Check-in
Untuk fixed dan shift, check-in:
- dibuka 3 jam sebelum jam kerja atau shift dimulai
- ditutup tepat saat jam kerja atau shift berakhir

Contoh fixed:
- jam kerja 08:00–17:00
- window check-in valid: 05:00–17:00
- 04:59 tidak valid
- 17:01 tidak valid

Untuk shift, aturan yang sama berlaku dengan acuan jam shift masing-masing.

### 4.2 Check-out
- Check-out hanya boleh dilakukan jika karyawan sudah check-in.
- Check-out dapat dilakukan sampai batas auto check-out.
- Jika admin melakukan koreksi manual dan jam check-out dibiarkan kosong, sistem otomatis mengisi jam berakhir kerja atau jam akhir shift.

## 5. Status Final yang Dipakai

Rekomendasi status final yang dipakai sistem:
- `ON_TIME`
- `LATE`
- `ABSENT` untuk mangkir / bolos
- `NO_CHECKOUT` untuk lupa check-out
- `SICK`
- `PERMIT`
- `DAY_OFF`

Aturan bahasa UI:
- `ABSENT` ditampilkan sebagai **Mangkir**
- `NO_CHECKOUT` ditampilkan sebagai **Lupa Check-out**
- "Lupa check-in" tidak ditampilkan sebagai status

## 6. Pendekatan yang Dipilih

Pendekatan yang dipilih adalah koreksi admin terstruktur:
- default sistem tetap: tidak check-in = mangkir
- jika ternyata karyawan benar-benar masuk, admin dapat membuat koreksi manual
- hasil akhir koreksi menjadi attendance normal
- sistem tetap menyimpan audit trail dan histori record mangkir awal

Pendekatan ini dipilih karena paling aman untuk payroll, report, dan histori perubahan.

## 7. Akses dan Permission

Tambahkan permission baru khusus:
- `attendance:correct-missed-checkin`

Aturan akses:
- tombol koreksi hanya tampil untuk user yang punya permission ini
- endpoint backend koreksi juga wajib memeriksa permission yang sama
- permission ini tidak digabung dengan permission edit attendance umum agar lebih aman dan lebih mudah diaudit

## 8. Desain UI Admin

### 8.1 Tombol action khusus
Tambahkan satu action khusus pada daftar absensi admin:
- label tombol: **Koreksi Lupa Absen**

Aturan visibilitas tombol:
- hanya muncul untuk record dengan status akhir mangkir / `ABSENT`
- hanya terlihat oleh role yang punya permission `attendance:correct-missed-checkin`

Aturan kondisi tombol:
- jika record belum pernah dikoreksi: tombol aktif
- jika record sudah pernah dikoreksi: tombol tetap tampil tetapi disabled

Tambahkan penanda visual pada record yang sudah dikoreksi:
- badge: **Sudah Dikoreksi**
- tooltip atau teks bantu pada tombol disabled: **Sudah dikoreksi admin**

### 8.2 Modal koreksi
Saat tombol diklik, tampilkan modal khusus.

#### Informasi read-only
- nama karyawan
- tanggal kerja
- status lama: Mangkir
- jadwal kerja atau shift hari itu

Catatan:
- tanggal kerja diambil otomatis dari record mangkir yang sedang dikoreksi
- tanggal kerja tidak dapat diubah manual

#### Input modal
Field wajib:
- jam check-in aktual
- foto bukti manual
- alasan koreksi

Field tersedia tambahan:
- jam check-out aktual
- catatan admin tambahan

Aturan khusus:
- jika jam check-out dikosongkan, sistem otomatis mengisi jam berakhir kerja atau akhir shift

## 9. Validasi Modal dan Submit

Validasi wajib:
- record sumber harus benar-benar status mangkir / `ABSENT`
- record sumber belum pernah dikoreksi
- jam check-in wajib diisi
- foto bukti wajib diisi
- alasan koreksi wajib diisi

Validasi waktu:
- jam check-in harus berada dalam window check-in yang sah
- jam check-out, jika diisi manual, harus lebih besar atau sama dengan jam check-in
- jam check-out otomatis menggunakan jam akhir kerja atau shift jika field dibiarkan kosong

## 10. Hasil Submit Koreksi

Setelah submit berhasil:
1. sistem menandai record mangkir lama sebagai sudah dikoreksi
2. sistem menyimpan siapa admin yang mengoreksi, kapan, dan alasannya
3. sistem membuat record attendance final baru
4. status final record baru dihitung dari jam check-in aktual:
   - jika masih dalam batas tepat waktu → `ON_TIME`
   - jika melewati batas keterlambatan → `LATE`
5. jika jam check-out kosong, sistem mengisi otomatis dengan jam akhir kerja atau shift

## 11. Model Histori dan Audit Trail

Record mangkir lama tidak dihapus dan tidak ditimpa. Record itu tetap disimpan sebagai histori.

Record mangkir lama harus menyimpan metadata koreksi:
- sudah dikoreksi manual
- admin yang melakukan koreksi
- waktu koreksi
- alasan koreksi
- referensi ke record attendance hasil koreksi

Record attendance hasil koreksi harus menyimpan metadata:
- sumber: koreksi admin
- referensi ke record mangkir asal
- foto bukti manual
- catatan admin tambahan jika ada

Tujuan desain ini:
- histori tidak hilang
- audit trail lengkap
- koreksi dapat ditelusuri dua arah

## 12. Perilaku di Daftar Absensi

### 12.1 Record mangkir lama
- tetap tampil sebagai histori
- diberi badge **Sudah Dikoreksi**
- tombol **Koreksi Lupa Absen** tetap tampil tetapi disabled

### 12.2 Record hasil koreksi
- tampil sebagai attendance final yang berlaku
- status final mengikuti hasil hitung ulang (`ON_TIME` atau `LATE`)
- dapat diberi badge **Koreksi Admin** agar mudah dibedakan dari attendance normal asli

## 13. Perilaku di Report dan Payroll

- Report akhir, rekap, dan payroll harus membaca record attendance final hasil koreksi
- Record mangkir lama yang sudah dikoreksi tidak boleh ikut dihitung lagi sebagai mangkir aktif
- Sistem harus menghindari double count antara record mangkir lama dan record hasil koreksi

Prinsip sumber kebenaran:
- record hasil koreksi = sumber kebenaran untuk rekap akhir
- record mangkir lama = histori audit

## 14. Ringkasan Keputusan

Keputusan final yang sudah disepakati:
- tidak ada status bisnis "lupa check-in"
- tidak check-in = mangkir / bolos
- lupa check-out tetap ada sebagai kasus terpisah
- koreksi lupa absen hanya dapat dilakukan manual oleh admin
- koreksi manual wajib memakai foto bukti
- tombol koreksi berbentuk action khusus di daftar absensi admin
- aksesnya memakai permission baru `attendance:correct-missed-checkin`
- setelah dikoreksi, record mangkir lama tetap disimpan dan ditandai
- tombol koreksi tetap tampil tetapi disabled jika sudah pernah dikoreksi
- jika jam check-out kosong saat koreksi, sistem otomatis isi jam akhir kerja atau shift

## 15. Scope Implementasi

Scope implementasi dari desain ini mencakup:
- permission baru untuk koreksi lupa absen
- tombol action baru di UI admin attendance
- modal khusus koreksi lupa absen
- validasi backend untuk koreksi manual
- pembuatan record attendance final hasil koreksi
- penandaan record mangkir lama sebagai corrected
- penyesuaian daftar absensi agar menampilkan histori dan hasil koreksi dengan benar
- penyesuaian report/payroll agar memakai record final dan tidak double count

Out of scope untuk desain ini:
- self-service correction dari mobile
- workflow approval bertingkat
- multi-step review selain koreksi admin langsung
- perubahan besar pada model shift di luar kebutuhan koreksi ini
