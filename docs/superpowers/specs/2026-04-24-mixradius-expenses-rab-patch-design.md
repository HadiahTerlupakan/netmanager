# Desain Patch MixRadius Expenses RAB

## Ringkasan
Patch ini memperbaiki dua masalah correctness pada fitur RAB di halaman `MixRadius Expenses`, lalu merapikan struktur komponen agar logika kalkulasi dan presentasi tidak terlalu menumpuk di file besar.

Fokus patch:
- menyamakan kalkulasi tabel tracking dan ringkasan pembagian di detail RAB
- mengeraskan flow approval RAB utama agar aman terhadap approval yang terjadi hampir bersamaan
- memecah area RAB yang terlalu berat menjadi helper dan subkomponen yang lebih fokus

## Tujuan
- Menghilangkan mismatch angka antara tabel tracking dan ringkasan hak investor/perusahaan di detail RAB.
- Memastikan approval RAB utama menghitung status dari data approval terbaru di database.
- Menurunkan kompleksitas `RABView.tsx` dan `RABList.tsx` tanpa mengubah perilaku produk.
- Menambah test regresi agar dua bug utama tidak muncul lagi.

## Ruang Lingkup
### Termasuk
- Ekstraksi helper kalkulasi tracking RAB dari area UI.
- Penyatuan sumber data untuk:
  - baris tracking bulanan
  - total akumulasi
  - ringkasan hak investor/perusahaan
- Perbaikan kalkulasi summary agar mengikuti revenue yang sudah memperhitungkan NPL tolerance pada bulan proyeksi.
- Hardening endpoint approval RAB utama di `app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts`.
- Refactor sedang pada `RABView.tsx` dan `RABList.tsx` dengan memindahkan concern berat ke util/subkomponen.
- Penambahan atau penyesuaian test unit/API/UI yang relevan.

### Tidak termasuk
- Mengubah aturan bisnis recovery modal, pembagian profit, atau threshold approval.
- Mendesain ulang UI/UX halaman RAB.
- Mengubah kontrak response API secara material.
- Memindahkan seluruh flow approval RAB ke domain route baru.
- Refactor lintas modul di luar area MixRadius Expenses RAB.

## Masalah yang Diperbaiki
### 1. Mismatch summary pembagian di detail RAB
Di `RABView`, tabel tracking bulanan memakai revenue proyeksi yang sudah dikurangi toleransi NPL, tetapi ringkasan hak investor/perusahaan di bagian bawah memakai fallback revenue yang belum dikurangi NPL. Akibatnya, total ringkasan bisa lebih tinggi dari data tabel untuk bulan yang belum memiliki actual.

### 2. Approval RAB utama rawan stale count
Endpoint approval RAB utama menghitung jumlah approval dari data approval yang dibaca sebelum insert approval baru. Dalam approval yang terjadi hampir bersamaan, status akhir berpotensi ditentukan dari count yang sudah stale.

### 3. Komponen RAB terlalu padat
`RABView.tsx` dan `RABList.tsx` memuat terlalu banyak concern sekaligus: kalkulasi bisnis, export, aksi approval, rendering tabel, kartu mobile, dan ringkasan turunan. Ini meningkatkan risiko regresi saat bugfix dilakukan.

## Desain Data dan Backend
### Approval RAB utama
Endpoint `POST /api/integrations/mixradius/expenses/rab/[id]/approve` tetap dipakai, tetapi flow internal diubah menjadi:
1. validasi session dan hak approval
2. validasi status proyek dan duplikasi approval user
3. simpan approval baru
4. hitung ulang approval `APPROVED` langsung dari database dalam transaction yang sama
5. tentukan status berikutnya berdasarkan count terbaru
6. update `rabProject` dan kembalikan data terbaru

Pendekatan ini mempertahankan contract API saat ini, tetapi menghilangkan ketergantungan pada `rab.approvals.length + 1`.

### Scope refactor backend
Tidak ada perubahan skema database. Tidak ada endpoint baru.

## Desain Kalkulasi RAB
### Helper tracking tunggal
Tambahkan helper terpusat untuk membangun simulasi tracking RAB bulanan dari data proyek dan actual achievement.

Helper ini menjadi satu-satunya sumber kalkulasi untuk:
- revenue proyeksi/aktual per bulan
- potensi NPL per bulan
- gross profit
- recovery installment
- sisa investasi
- investor share
- company share
- total akumulasi
- summary hak investor/perusahaan

### Aturan penting helper
- Untuk bulan tanpa actual, revenue fallback harus sama dengan tabel tracking saat ini: target revenue setelah toleransi NPL.
- Untuk skema `POSTPAID`, billing subscriber tetap mengikuti offset bulan sebelumnya seperti perilaku existing.
- Manual override (`manualRecoveryInstallment`, `manualInvestorShare`, `manualCompanyShare`, `manualInvestorProfitSharePercent`) tetap menang atas hasil kalkulasi default.
- Summary bawah harus dihitung dari dataset hasil helper yang sama, bukan dari kalkulasi terpisah.

## Desain Refactor Frontend
### RABView
`RABView.tsx` dipecah menjadi area yang lebih fokus:
- ringkasan identitas dan financial overview
- analitik revisi dan variance
- tracking pencapaian dan summary pembagian
- daftar item dan termin pencairan
- modal penolakan revisi

Logika tracking dipindahkan ke helper util. Komponen tampilan hanya menerima hasil kalkulasi dan merendernya.

### RABList
`RABList.tsx` dirapikan dengan memindahkan kalkulasi/export berat ke util terpisah, khususnya area yang tidak perlu berada di body komponen render, seperti:
- kalkulasi BEP dan growth turunan yang reusable
- builder export CSV/PDF bila perlu dipisah agar file lebih fokus

Refactor ini tetap menjaga perilaku tombol, label, dan action yang sudah ada.

## Testing
Tambahkan atau sesuaikan test berikut:
- **Unit test helper tracking RAB**
  - memastikan fallback revenue proyeksi sudah memperhitungkan NPL tolerance
  - memastikan total summary investor/perusahaan konsisten dengan agregasi baris tracking
  - memastikan manual override tetap diprioritaskan
- **API test approval RAB utama**
  - memastikan approval pertama menggeser status sesuai flow existing
  - memastikan threshold approval akhir memakai count terbaru dari database
  - memastikan duplicate approval tetap ditolak
- **UI/logic regression test bila diperlukan**
  - memastikan komponen yang memakai helper baru tetap menampilkan angka yang konsisten

## Dampak Perubahan
- Angka ringkasan pembagian di detail RAB akan berubah pada kasus bulan proyeksi yang sebelumnya salah hitung karena mismatch NPL.
- Endpoint approval RAB utama menjadi lebih tahan terhadap approval hampir bersamaan.
- File RAB menjadi lebih mudah dibaca, diuji, dan diubah pada patch berikutnya.

## Keputusan Desain
Pendekatan yang dipilih adalah refactor sedang sambil memperbaiki dua bug correctness.

Alasan:
- cukup aman untuk branch bugfix aktif
- menyelesaikan akar mismatch kalkulasi, bukan hanya gejalanya
- menurunkan risiko regresi berikutnya dengan memisahkan kalkulasi bisnis dari rendering UI
- tidak mengubah aturan bisnis atau contract API yang sudah dipakai area lain
