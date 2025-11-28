# Laporan Status Sistem Billing

**Tanggal Pemeriksaan:** $(date)  
**Status:** ⚠️ **BELUM BERJALAN DENGAN LENGKAP**

## Ringkasan Eksekutif

Sistem billing di aplikasi ini **belum sepenuhnya diimplementasikan**. Meskipun ada beberapa komponen dasar seperti UI untuk menampilkan tagihan dan logika perhitungan tagihan di form pelanggan, sistem billing yang lengkap dan fungsional belum tersedia. Halaman tagihan masih menggunakan **dummy data** dan tidak terhubung dengan database atau API.

---

## 1. Pemeriksaan Database Schema

### ❌ **TIDAK ADA Model Tagihan/Invoice**

**File:** `prisma/schema.prisma`

**Temuan:**
- Tidak ada model `Tagihan` atau `Invoice` di database schema
- Model `Pelanggan` memiliki field `jatuhTempo` (tanggal jatuh tempo) tetapi tidak ada relasi ke model tagihan
- Tidak ada tracking untuk:
  - Riwayat tagihan per pelanggan
  - Status pembayaran (LUNAS, BELUM_LUNAS, TERLAMBAT)
  - Tanggal pembayaran
  - Nomor invoice/tagihan
  - Detail rincian tagihan (subtotal, diskon, PPN, total)

**Yang Ada:**
- Model `Pelanggan` dengan field:
  - `jatuhTempo: DateTime` - Tanggal jatuh tempo pembayaran
  - `hargaPaketId` - Relasi ke paket yang digunakan
  - Field untuk biaya: `biayaInstalasi`, `biayaSewaPerangkat`, `biayaLainnya`
  - Field untuk diskon dan PPN

**Rekomendasi:**
Perlu membuat model `Tagihan` dengan struktur seperti:
```prisma
model Tagihan {
  id            String   @id @default(cuid())
  pelangganId   String
  pelanggan     Pelanggan @relation(fields: [pelangganId], references: [id])
  periodeBulan Int      // 1-12
  periodeTahun Int      // 2024, 2025, dll
  jumlah        Int      // Total tagihan dalam rupiah
  subtotal      Int      // Subtotal sebelum PPN dan diskon
  diskon        Int      // Jumlah diskon
  ppn           Int      // Jumlah PPN
  jatuhTempo    DateTime
  status        TagihanStatus @default(BELUM_LUNAS)
  tanggalBayar  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([pelangganId, periodeBulan, periodeTahun])
  @@index([pelangganId])
  @@index([status])
  @@index([jatuhTempo])
}

enum TagihanStatus {
  BELUM_LUNAS
  LUNAS
  TERLAMBAT
}
```

---

## 2. Pemeriksaan API Endpoints

### ❌ **TIDAK ADA API Endpoints untuk Tagihan**

**File:** `app/api/`

**Temuan:**
- Tidak ada folder `/api/tagihan/` atau `/api/invoice/`
- Tidak ada endpoint untuk:
  - `GET /api/tagihan` - List tagihan pelanggan
  - `GET /api/tagihan/[id]` - Detail tagihan
  - `POST /api/tagihan/generate` - Generate tagihan bulanan
  - `PUT /api/tagihan/[id]/bayar` - Update status pembayaran
  - `GET /api/tagihan/pelanggan/[pelangganId]` - Tagihan per pelanggan

**Yang Ada:**
- API untuk pelanggan: `/api/pelanggan-ppp/`
- API untuk paket: `/api/hargapakets/`
- Tidak ada integrasi antara pelanggan dan tagihan

**Rekomendasi:**
Perlu membuat API endpoints:
1. `app/api/tagihan/route.ts` - GET (list), POST (generate manual)
2. `app/api/tagihan/[id]/route.ts` - GET (detail), PUT (update status)
3. `app/api/tagihan/pelanggan/[pelangganId]/route.ts` - GET tagihan per pelanggan
4. `app/api/tagihan/generate/route.ts` - POST untuk generate tagihan bulanan

---

## 3. Pemeriksaan UI dan Frontend

### ⚠️ **UI ADA TAPI MENGGUNAKAN DUMMY DATA**

**File:** `app/pelanggan/tagihan/page.tsx`

**Temuan:**
- ✅ Halaman tagihan sudah ada di `/pelanggan/tagihan`
- ✅ UI sudah lengkap dengan:
  - Tab "Tagihan Aktif" dan "Riwayat"
  - Card untuk setiap tagihan
  - Status badge (LUNAS, BELUM_LUNAS, TERLAMBAT)
  - Format rupiah dan tanggal
- ❌ **Menggunakan dummy data hardcoded** (baris 38-74)
- ❌ Tidak ada API call untuk fetch data tagihan
- ❌ Tidak ada form untuk input pembayaran
- ❌ Button "Bayar Sekarang" tidak memiliki fungsi

**Kode yang Masalah:**
```37:74:app/pelanggan/tagihan/page.tsx
  // Dummy data tagihan
  const [tagihanList] = useState<TagihanItem[]>([
    {
      id: '1',
      bulan: 'November',
      tahun: 2025,
      jumlah: 150000,
      jatuhTempo: '2025-11-30',
      status: 'BELUM_LUNAS',
    },
    // ... lebih banyak dummy data
  ])
```

**Rekomendasi:**
1. Ganti dummy data dengan API call:
   ```typescript
   useEffect(() => {
     const fetchTagihan = async () => {
       const response = await fetch('/api/tagihan/pelanggan/[id]')
       const data = await response.json()
       setTagihanList(data)
     }
     fetchTagihan()
   }, [])
   ```

2. Implementasikan fungsi pembayaran untuk button "Bayar Sekarang"

3. Tambahkan loading state dan error handling

**Admin Dashboard:**
- ❌ Tidak ada halaman admin untuk manage tagihan
- ❌ Tidak ada menu di sidebar untuk "Tagihan" atau "Billing"
- ❌ Tidak ada dashboard untuk melihat:
  - Total tagihan belum dibayar
  - Tagihan terlambat
  - Statistik pembayaran

**Rekomendasi:**
Tambahkan halaman admin:
- `app/admin/tagihan/page.tsx` - List semua tagihan
- `app/admin/tagihan/generate/page.tsx` - Generate tagihan bulanan
- Menu di sidebar: `/admin/tagihan`

---

## 4. Pemeriksaan Sistem Otomatis (Cron Jobs)

### ❌ **TIDAK ADA Cron Job untuk Generate Tagihan**

**File:** `lib/cron/`

**Temuan:**
- Tidak ada file untuk billing scheduler
- Hanya ada cron jobs untuk:
  - `olt-sync-scheduler.ts` - Sync data OLT
  - `onu-sync-scheduler.ts` - Sync data ONU
  - `mikrotik-ping-scheduler.ts` - Check status MikroTik
- Tidak ada scheduler untuk:
  - Generate tagihan bulanan otomatis
  - Update status tagihan terlambat
  - Reminder tagihan jatuh tempo

**File yang Ada:**
- `lib/cron/start-scheduler.ts` - Hanya start 3 scheduler di atas

**Rekomendasi:**
Buat cron job baru:
1. `lib/cron/tagihan-generator-scheduler.ts` - Generate tagihan bulanan
   - Jalankan setiap tanggal 1 setiap bulan
   - Generate tagihan untuk semua pelanggan aktif
   - Hitung berdasarkan paket dan biaya tambahan

2. `lib/cron/tagihan-status-updater.ts` - Update status tagihan terlambat
   - Jalankan setiap hari
   - Update tagihan yang sudah lewat jatuh tempo menjadi TERLAMBAT

3. Tambahkan ke `start-scheduler.ts`:
   ```typescript
   import { startTagihanGeneratorScheduler } from './tagihan-generator-scheduler'
   import { startTagihanStatusUpdater } from './tagihan-status-updater'
   ```

---

## 5. Pemeriksaan Services dan Repositories

### ❌ **TIDAK ADA Service/Repository untuk Billing**

**File:** `lib/services/` dan `lib/repositories/`

**Temuan:**
- Tidak ada file `tagihan-service.ts` atau `billing-service.ts`
- Tidak ada repository `TagihanRepository.ts`
- Tidak ada interface `ITagihanRepository.ts`
- Tidak ada export di `lib/repositories/index.ts`

**Yang Ada:**
- Services untuk: OLT sync, ONU sync, MikroTik
- Repositories untuk: User, OLT, ONU, ODP, ODC, dll
- Tidak ada untuk Tagihan/Billing

**Rekomendasi:**
Buat struktur berikut:

1. **Repository:**
   - `lib/repositories/ITagihanRepository.ts` - Interface
   - `lib/repositories/TagihanRepository.ts` - Implementation
   - Export di `lib/repositories/index.ts`

2. **Service:**
   - `lib/services/tagihan-service.ts` - Business logic untuk:
     - Generate tagihan bulanan
     - Hitung total tagihan (subtotal, diskon, PPN)
     - Update status pembayaran
     - Get tagihan per pelanggan

---

## 6. Pemeriksaan Integrasi Pembayaran

### ❌ **TIDAK ADA Integrasi Payment Gateway**

**Temuan:**
- Tidak ada integrasi dengan payment gateway (Midtrans, Xendit, dll)
- Tidak ada webhook untuk callback pembayaran
- Tidak ada sistem verifikasi pembayaran otomatis
- Button "Bayar Sekarang" tidak memiliki fungsi

**Rekomendasi:**
1. Pilih payment gateway (Midtrans, Xendit, atau lainnya)
2. Buat service untuk integrasi payment gateway
3. Buat endpoint webhook untuk callback pembayaran
4. Update status tagihan otomatis setelah pembayaran berhasil

---

## Ringkasan Status

| Komponen | Status | Keterangan |
|----------|--------|------------|
| Database Schema | ❌ | Tidak ada model Tagihan |
| API Endpoints | ❌ | Tidak ada endpoint untuk tagihan |
| UI Pelanggan | ⚠️ | Ada tapi pakai dummy data |
| UI Admin | ❌ | Tidak ada dashboard tagihan |
| Cron Jobs | ❌ | Tidak ada scheduler untuk generate tagihan |
| Services | ❌ | Tidak ada service untuk billing |
| Repositories | ❌ | Tidak ada repository untuk tagihan |
| Payment Gateway | ❌ | Tidak ada integrasi |

---

## Rekomendasi Implementasi

### Prioritas Tinggi (Harus Ada)

1. **Database Schema**
   - Buat model `Tagihan` dengan relasi ke `Pelanggan`
   - Buat enum `TagihanStatus`
   - Migration database

2. **Repository & Service**
   - Buat `TagihanRepository` dan `ITagihanRepository`
   - Buat `tagihan-service.ts` dengan fungsi:
     - `generateTagihanBulanan(pelangganId, bulan, tahun)`
     - `hitungTotalTagihan(pelanggan)`
     - `updateStatusPembayaran(tagihanId, tanggalBayar)`

3. **API Endpoints**
   - `GET /api/tagihan/pelanggan/[pelangganId]` - List tagihan pelanggan
   - `POST /api/tagihan/generate` - Generate tagihan manual (admin)
   - `PUT /api/tagihan/[id]/bayar` - Update status pembayaran

4. **Update UI Pelanggan**
   - Ganti dummy data dengan API call
   - Implementasikan fetch tagihan dari database
   - Tambahkan loading dan error handling

### Prioritas Sedang

5. **Cron Job**
   - Generate tagihan bulanan otomatis (tanggal 1 setiap bulan)
   - Update status tagihan terlambat (setiap hari)

6. **Admin Dashboard**
   - Halaman list semua tagihan
   - Filter dan search tagihan
   - Generate tagihan manual
   - Statistik pembayaran

### Prioritas Rendah

7. **Payment Gateway Integration**
   - Integrasi dengan payment gateway
   - Webhook untuk callback
   - Verifikasi pembayaran otomatis

8. **Notifikasi**
   - Email/SMS reminder tagihan jatuh tempo
   - Notifikasi setelah pembayaran berhasil

---

## Kesimpulan

Sistem billing di aplikasi ini **belum berjalan**. Yang ada saat ini hanya:
- UI halaman tagihan (tapi pakai dummy data)
- Logika perhitungan tagihan di form pelanggan (hanya untuk preview)
- Field `jatuhTempo` di model Pelanggan

Untuk membuat sistem billing yang lengkap, perlu implementasi:
1. Database model untuk Tagihan
2. API endpoints untuk CRUD tagihan
3. Service dan repository untuk business logic
4. Cron job untuk generate tagihan otomatis
5. Update UI untuk menggunakan data real
6. Admin dashboard untuk manage tagihan
7. Integrasi payment gateway (opsional)

**Estimasi Waktu Implementasi:** 2-3 minggu (tergantung kompleksitas payment gateway)

---

**Dibuat oleh:** Sistem Pemeriksaan Otomatis  
**Tanggal:** $(date)










