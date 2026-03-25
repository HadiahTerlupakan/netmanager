# PRD: Attendance Deduplication & Clarity Refinement

## Context
Sistem saat ini mengalami duplikasi data ketika karyawan memiliki izin yang disetujui sekaligus record absensi (baik auto-generated maupun manual). Selain itu, label status "Mangkir" (Alpha) perlu dibedakan antara yang benar-benar tidak hadir dengan yang hanya lupa check-out.

## Acceptance Criteria
1. **Deduplication**: Jika ada izin (Sakit/Izin) pada hari tertentu, record absensi reguler untuk user & hari tersebut HARUS disembunyikan.
2. **Void Initial Check-in**: Jika user check-in lalu mengajukan izin di hari yang sama, status izin harus menang (gugurkan absen awal).
3. **Mangkir vs Alpha**:
   - Jika status `ALPHA` dan jam masuk `00:00` (auto-gen): Tampilkan "Tidak Hadir", sembunyikan lokasi.
   - Jika status `ALPHA` tapi ada jam masuk riil: Tampilkan "Hadir, Tidak Checkout", tampilkan lokasi masuk.
4. **Label Refinement**: Ubah label "Absen" menjadi "Hadir, Tidak Checkout" untuk kasus lupa absen pulang.
5. **Location Logic**: Sembunyikan lokasi jika karyawan berstatus Sakit, Izin, atau Tidak Hadir (Alpha murni).

## Tasks
- [ ] ATT-008: Implement API level filtering for leave vs attendance conflict.
- [ ] ATT-009: Refine UI labels for Mangkir/No-checkout cases in AttendanceClient.tsx.
- [ ] ATT-010: Hide location for auto-generated or non-attendance entries.
