# Database Seeding Guide

Panduan untuk melakukan seeding database NetManager dengan data dummy untuk keperluan testing dan development.

## 📋 Daftar Seed Scripts

### 1. **seed.ts** (Basic)
Seed dasar yang hanya membuat admin user.

```bash
npm run seed
# atau
npx tsx prisma/seed.ts
```

### 2. **seed-all.ts** (Comprehensive) ⭐ **RECOMMENDED**
Seed lengkap yang mencakup semua modul NetManager.

```bash
npx tsx scripts/seed-all.ts
```

**Data yang di-seed:**
- ✅ 3 Users (Admin, Finance, HR)
- ✅ Network Infrastructure (OLT, MikroTik, Bandwidth, Profiles)
- ✅ 3 Paket Internet (10M, 20M, 50M)
- ✅ 5 Departments (IT, Technical, Finance, HR, CS)
- ✅ 4 Positions
- ✅ 3 Employees
- ✅ 20 Customers (Pelanggan)
- ✅ ~60 Invoices (Tagihan) - 3 bulan terakhir
- ✅ 4 Ticket Categories
- ✅ 15 Tickets
- ✅ 10 Work Orders
- ✅ 30 Finance Records (20 Expenses, 10 Income)

### 3. **seed-employees.ts**
Seed khusus untuk HRIS data.

```bash
npx tsx scripts/seed-employees.ts
```

### 4. **seed-tax-budget.ts**
Seed untuk Tax dan Budget categories.

```bash
npx tsx scripts/seed-tax-budget.ts
```

### 5. **seed-ticket-categories.ts**
Seed untuk Helpdesk ticket categories.

```bash
npx tsx scripts/seed-ticket-categories.ts
```

## 🚀 Quick Start

### Reset Database dan Seed Ulang

```bash
# 1. Reset database (HATI-HATI: ini akan menghapus semua data!)
npx prisma migrate reset --skip-seed

# 2. Jalankan seed lengkap
npx tsx scripts/seed-all.ts
```

### Seed Tambahan (Tanpa Reset)

Jika database sudah ada dan hanya ingin menambah data:

```bash
npx tsx scripts/seed-all.ts
```

Script akan menggunakan `upsert` sehingga tidak akan duplikat data yang sudah ada.

## 🔑 Default Login Credentials

### Admin Portal

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@netmanager.com | password123 |
| Finance | finance@netmanager.com | password123 |
| HR | hr@netmanager.com | password123 |

### Customer Portal

| ID Pelanggan | Password |
|--------------|----------|
| 10000001 - 10000020 | pelanggan123 |

### Employee Portal

| Email | Password |
|-------|----------|
| budi@netmanager.com | password123 |
| siti@netmanager.com | password123 |
| andi@netmanager.com | password123 |

## 📊 Data Details

### Customers (Pelanggan)

- **Total:** 20 pelanggan
- **Status:** 18 aktif, 2 non-aktif
- **Paket:**
  - 7 pelanggan paket 10 Mbps
  - 8 pelanggan paket 20 Mbps
  - 5 pelanggan paket 50 Mbps

### Invoices (Tagihan)

- **Period:** 3 bulan terakhir
- **Total:** ~60 tagihan
- **Status:** Mix antara LUNAS dan BELUM_LUNAS
- Tagihan bulan lama lebih banyak yang sudah lunas

### Employees

1. **Budi Santoso** (EMP-001)
   - Department: Technical
   - Position: Field Technician
   - Status: Permanent

2. **Siti Nurhaliza** (EMP-002)
   - Department: Customer Service
   - Position: CS Representative
   - Status: Permanent

3. **Andi Wijaya** (EMP-003)
   - Department: Finance
   - Position: Finance Staff
   - Status: Permanent

### Tickets

- **Total:** 15 tickets
- **Categories:** Koneksi Terputus, Billing, Permintaan Upgrade, Lainnya
- **Status:** Mix (Open, In Progress, Resolved, Closed)
- **Priority:** Mix (Low, Normal, High, Urgent)

### Work Orders

- **Total:** 10 work orders
- **Types:** Installation, Troubleshoot, Maintenance, Upgrade
- **Status:** Mix (Pending, Assigned, In Progress, Completed)

## 🔧 Troubleshooting

### Error: Unique constraint violation

Jika ada error unique constraint, berarti data sudah ada. Anda bisa:

1. **Reset database:**
   ```bash
   npx prisma migrate reset --skip-seed
   npx tsx scripts/seed-all.ts
   ```

2. **Atau hapus data spesifik di Prisma Studio:**
   ```bash
   npx prisma studio
   ```

### Error: Foreign key constraint

Pastikan urutan seeding benar. Script `seed-all.ts` sudah menghandle dependencies dengan benar:

1. Users
2. Network Infrastructure
3. HRIS (Departments, Positions, Employees)
4. Customers
5. Invoices
6. Tickets
7. Work Orders
8. Finance

### Database connection error

Pastikan:
- PostgreSQL sudah running
- Environment variable `DATABASE_URL` sudah di-set di `.env`
- Database sudah dibuat

```bash
# Check connection
npx prisma db pull
```

## 💡 Tips

### 1. Seed hanya module tertentu

Anda bisa copy script `seed-all.ts` dan hapus bagian yang tidak diperlukan.

### 2. Custom data amount

Edit angka di loop untuk menambah/mengurangi jumlah data:

```typescript
// Di seed-all.ts
for (let i = 1; i <= 20; i++) {  // Ubah 20 menjadi jumlah yang diinginkan
  // Create customers
}
```

### 3. Lihat data di Prisma Studio

```bash
npx prisma studio
```

Browser akan terbuka di `http://localhost:5555` dengan GUI untuk melihat semua data.

## 📝 Notes

- Semua password menggunakan bcrypt hash dengan cost 10
- Tanggal dibuat secara random dalam range yang realistis
- Data customer tersebar di berbagai status untuk simulasi realistic
- Invoice status lebih banyak LUNAS untuk bulan-bulan yang sudah lama
- Foreign key relationships sudah dihandle dengan benar

## 🆘 Need Help?

Jika ada masalah dengan seeding:

1. Check error message di console
2. Verifikasi database schema: `npx prisma db pull`
3. Reset dan coba lagi: `npx prisma migrate reset`
4. Lihat logs di console untuk detail error
