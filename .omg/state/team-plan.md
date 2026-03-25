# Plan: Attendance Refinement

## Strategy
Kita akan menggunakan logika penyaringan di API untuk mendahulukan data `LeaveRequest` daripada `Attendance` jika terjadi konflik pada hari yang sama. Di sisi UI, kita akan mendeteksi jam masuk `00:00` sebagai penanda data auto-generated yang tidak perlu menampilkan detail lokasi atau jam kerja riil.

## Implementation Steps
1. **API Update (route.ts)**:
   - Identifikasi konflik User-Date antara `LeaveRequest` dan `Attendance`.
   - Filter `allAttendances` untuk menghapus record yang berkonflik atau auto-generated.
   - (Sudah dimulai di turn sebelumnya, perlu verifikasi final).
2. **UI Update (AttendanceClient.tsx)**:
   - Update `jamKerja` render logic:
     - Jika `isLeave` -> Tampilkan status (Sakit/Izin).
     - Jika `ALPHA` & `checkIn` == `00:00` -> Tampilkan "Tidak Hadir".
     - Jika `ALPHA` & `checkIn` > `00:00` -> Tampilkan jam IN + "Tidak Check-out".
   - Update `location` render logic:
     - Sembunyikan jika `isLeave` atau `ALPHA` murni.
     - Tampilkan Lokasi Masuk saja jika "Hadir, Tidak Checkout".

## Verification
- Run `npm run check`.
- Cek duplikasi record di environment dev.
