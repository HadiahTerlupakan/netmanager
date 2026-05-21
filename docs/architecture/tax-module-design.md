# Tax Module — Design Specification

**Project:** ISP NetManager
**Versi:** 1.0
**Tanggal:** 2026-05-21
**Status:** Draft — Siap Implementasi

---

## 1. Overview

Modul `tax` menangani seluruh kewajiban perpajakan ISP Indonesia secara otomatis:

| Jenis Pajak | Trigger | Jurnal Otomatis |
|---|---|---|
| PPN Keluaran | Invoice dibuat | DR Piutang PPN / CR Hutang PPN Keluaran |
| PPN Masukan | Expense/PO disetujui | DR PPN Masukan / CR Kas |
| PPh 21 | Salary diproses | DR Beban Gaji / CR Hutang PPh 21 |
| PPh 23 | Expense jasa disetujui | DR Beban Jasa / CR Hutang PPh 23 |
| PPh 4(2) | Expense sewa disetujui | DR Beban Sewa / CR Hutang PPh 4(2) |
| BHP | Kalkulasi bulanan | DR Beban BHP / CR Hutang BHP |
| USO | Kalkulasi bulanan | DR Beban USO / CR Hutang USO |

**Batasan v1:**
- Tidak menggantikan e-Filing SPT — menyediakan data rekap siap lapor (CSV/PDF)
- Tidak integrasi langsung ke DJP/Coretax
- Tenant non-PKP: PPN dinonaktifkan via config

---

## 2. Module Structure

```
modules/tax/
├── domain/
│   ├── entities/
│   │   ├── TaxConfig.ts
│   │   ├── TaxTransaction.ts
│   │   └── TaxPeriod.ts
│   └── ports/
│       ├── ITaxConfigRepository.ts
│       ├── ITaxTransactionRepository.ts
│       └── ITaxPeriodRepository.ts
├── dto/
│   ├── TaxConfigDto.ts
│   ├── TaxPeriodSummaryDto.ts
│   └── TaxExportDto.ts
├── repositories/
│   ├── TaxConfigRepository.ts
│   ├── TaxTransactionRepository.ts
│   └── TaxPeriodRepository.ts
├── services/
│   ├── TaxConfigService.ts
│   ├── PpnService.ts
│   ├── PphService.ts
│   ├── BhpUsoService.ts
│   ├── TaxPeriodService.ts
│   ├── TaxReminderService.ts
│   ├── TaxExportService.ts
│   └── event-handlers/
│       ├── invoice-created-tax.handler.ts
│       ├── expense-approved-tax.handler.ts
│       ├── purchase-order-paid-tax.handler.ts
│       └── salary-processed-tax.handler.ts
├── validators/
│   ├── tax-config.validator.ts
│   └── tax-period.validator.ts
└── index.ts
```

---

## 3. Database Schema

```prisma
// ============================================
// TAX MODULE
// ============================================

enum TaxType {
  PPN_KELUARAN
  PPN_MASUKAN
  PPH_21
  PPH_23
  PPH_4_2
  BHP
  USO
  KSO
}

enum TaxDirection {
  IN    // Masukan (kredit pajak)
  OUT   // Keluaran (kewajiban pajak)
}

enum TaxPayStatus {
  BELUM_SETOR
  SUDAH_SETOR
  TERLAMBAT
}

model TaxConfig {
  id              String   @id @default(uuid())
  tenantId        String   @unique
  npwp            String?
  companyName     String?
  isPkp           Boolean  @default(false)
  ppnRate         Decimal  @default(11)       // Persen
  ppnIncluded     Boolean  @default(false)    // Harga sudah include PPN
  pph23RateJasa   Decimal  @default(2)
  pph23RateSewa   Decimal  @default(2)
  pph4Rate        Decimal  @default(10)       // Sewa tanah/bangunan
  bhpRate         Decimal  @default(0.5)      // % dari pendapatan kotor
  usoRate         Decimal  @default(1.25)
  ksoRate         Decimal  @default(0)        // 0 = tidak ada KSO
  ppnDueDay       Int      @default(15)       // Tanggal setor PPN
  pph21DueDay     Int      @default(10)
  pph23DueDay     Int      @default(10)
  bhpDueMonth     Int      @default(4)        // Bulan setor BHP (April)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("tax_configs")
}

model TaxTransaction {
  id            String       @id @default(uuid())
  tenantId      String
  taxType       TaxType
  direction     TaxDirection
  amount        Decimal      @db.Decimal(19, 2)  // DPP
  taxAmount     Decimal      @db.Decimal(19, 2)  // Nilai pajak
  rate          Decimal      @db.Decimal(5, 2)   // Tarif saat transaksi
  sourceRefType String       // "Invoice" | "Expense" | "PurchaseOrder" | "Salary"
  sourceRefId   String
  periodYear    Int
  periodMonth   Int
  journalId     String?      // FK ke JournalEntry
  notes         String?
  createdAt     DateTime     @default(now())

  @@unique([tenantId, sourceRefType, sourceRefId, taxType])
  @@index([tenantId, periodYear, periodMonth])
  @@index([tenantId, taxType])
  @@map("tax_transactions")
}

model TaxPeriodSummary {
  id              String       @id @default(uuid())
  tenantId        String
  year            Int
  month           Int
  ppnKeluaran     Decimal      @default(0) @db.Decimal(19, 2)
  ppnMasukan      Decimal      @default(0) @db.Decimal(19, 2)
  ppnKurangBayar  Decimal      @default(0) @db.Decimal(19, 2)
  pph21Total      Decimal      @default(0) @db.Decimal(19, 2)
  pph23Total      Decimal      @default(0) @db.Decimal(19, 2)
  pph4Total       Decimal      @default(0) @db.Decimal(19, 2)
  bhpAccrual      Decimal      @default(0) @db.Decimal(19, 2)
  usoAccrual      Decimal      @default(0) @db.Decimal(19, 2)
  ppnStatus       TaxPayStatus @default(BELUM_SETOR)
  pph21Status     TaxPayStatus @default(BELUM_SETOR)
  pph23Status     TaxPayStatus @default(BELUM_SETOR)
  pph4Status      TaxPayStatus @default(BELUM_SETOR)
  bhpStatus       TaxPayStatus @default(BELUM_SETOR)
  ppnPaidAt       DateTime?
  pph21PaidAt     DateTime?
  pph23PaidAt     DateTime?
  pph4PaidAt      DateTime?
  bhpPaidAt       DateTime?
  ppnPenalty      Decimal      @default(0) @db.Decimal(19, 2)
  pph21Penalty    Decimal      @default(0) @db.Decimal(19, 2)
  pph23Penalty    Decimal      @default(0) @db.Decimal(19, 2)
  calculatedAt    DateTime?
  lockedAt        DateTime?    // Dikunci setelah SPT dilaporkan
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([tenantId, year, month])
  @@index([tenantId, year])
  @@map("tax_period_summaries")
}

model TaxReminder {
  id        String   @id @default(uuid())
  tenantId  String
  taxType   TaxType
  year      Int
  month     Int
  dueDate   DateTime
  status    String   @default("PENDING") // PENDING | SENT | ACKNOWLEDGED
  sentAt    DateTime?
  createdAt DateTime @default(now())

  @@unique([tenantId, taxType, year, month])
  @@index([status, dueDate])
  @@map("tax_reminders")
}
```

---

## 4. Service Layer

### 4.1 PpnService
- `recordPpnKeluaran(tenantId, invoiceId, amount, date)` — saat invoice dibuat
- `recordPpnMasukan(tenantId, expenseId, amount, date)` — saat expense dengan faktur pajak
- Cek `isPkp` sebelum proses — non-PKP skip
- Idempotent via `findBySource(tenantId, sourceRefType, sourceRefId, taxType)`
- Jurnal PPN Keluaran: DR Piutang PPN (1-250) / CR Hutang PPN Keluaran (2-300)
- Jurnal PPN Masukan: DR PPN Masukan (1-250) / CR Kas/Bank

### 4.2 PphService
- `recordPph21(tenantId, salaryId, grossSalary, pph21Amount, date)` — dari salary
- `recordPph23(tenantId, expenseId, amount, category, date)` — dari expense jasa (2%)
- `recordPph4(tenantId, expenseId, amount, date)` — dari expense sewa tanah/bangunan (10%)
- Tarif dari TaxConfig per tenant
- Jurnal PPh 21: DR Beban Gaji (5-100) / CR Hutang PPh 21 (2-400)
- Jurnal PPh 23: DR Beban Jasa / CR Hutang PPh 23 (2-410)

### 4.3 BhpUsoService
- `calculateMonthly(tenantId, year, month)` — hitung BHP/USO dari total revenue bulan itu
- Revenue diambil dari JournalLine akun tipe REVENUE yang sudah POSTED
- `bhpAmount = totalRevenue * bhpRate / 100`
- `usoAmount = totalRevenue * usoRate / 100`
- Jurnal: DR Beban BHP (5-710) / CR Hutang BHP (2-500)

### 4.4 TaxPeriodService
- `recalculate(tenantId, year, month)` — aggregate semua TaxTransaction bulan itu
- `markPaid(tenantId, year, month, taxType)` — tandai sudah setor
- `lock(tenantId, year, month)` — kunci setelah SPT dilaporkan
- `getSummary(tenantId, year, month)` — untuk UI rekap

### 4.5 TaxReminderService
- `checkDueReminders()` — cron harian, cek semua tenant
- `calculatePenalty(tenantId, year, month, taxType)` — hitung denda keterlambatan
- Kirim notifikasi via sistem notifikasi existing

### 4.6 TaxExportService
- `exportPpnSummary(tenantId, year, month)` — CSV rekap PPN
- `exportPph21Summary(tenantId, year, month)` — CSV rekap PPh 21
- `exportBhpUso(tenantId, year)` — CSV rekap BHP/USO tahunan

---

## 5. Event Handlers

| Handler | Event | Action |
|---|---|---|
| invoice-created-tax | INVOICE_CREATED | PPN Keluaran (jika PKP) |
| expense-approved-tax | EXPENSE_APPROVED | PPN Masukan + PPh 23/4(2) |
| purchase-order-paid-tax | PURCHASE_ORDER_PAID | PPN Masukan |
| salary-processed-tax | SALARY_PROCESSED (baru) | PPh 21 |

---

## 6. COA Additions

Tambahkan ke default seed:

| Kode | Nama | Tipe | Subtype | Parent |
|---|---|---|---|---|
| 1-250 | PPN Masukan | ASSET | CURRENT_ASSET | 1-100 |
| 2-300 | Hutang PPN Keluaran | LIABILITY | CURRENT_LIABILITY | 2-000 |
| 2-400 | Hutang PPh 21 | LIABILITY | CURRENT_LIABILITY | 2-000 |
| 2-410 | Hutang PPh 23 | LIABILITY | CURRENT_LIABILITY | 2-000 |
| 2-420 | Hutang PPh 4(2) | LIABILITY | CURRENT_LIABILITY | 2-000 |
| 2-500 | Hutang BHP | LIABILITY | CURRENT_LIABILITY | 2-000 |
| 2-510 | Hutang USO | LIABILITY | CURRENT_LIABILITY | 2-000 |
| 5-700 | Beban Pajak | EXPENSE | OPEX | 5-000 |
| 5-710 | Beban BHP | EXPENSE | OPEX | 5-700 |
| 5-720 | Beban USO | EXPENSE | OPEX | 5-700 |

---

## 7. API Routes

```
app/api/admin/tax/
├── config/route.ts              GET, PUT (konfigurasi pajak)
├── period/route.ts              GET (list periods by year)
├── period/[year]/[month]/
│   ├── route.ts                 GET (summary), POST (recalculate)
│   ├── mark-paid/route.ts       POST (mark tax type as paid)
│   └── lock/route.ts            POST (lock period)
├── transactions/route.ts        GET (list with filters)
├── export/
│   ├── ppn/route.ts             GET (export PPN CSV)
│   ├── pph21/route.ts           GET (export PPh 21 CSV)
│   └── bhp-uso/route.ts         GET (export BHP/USO CSV)
├── bhp-uso/calculate/route.ts   POST (trigger calculation)
└── reminders/route.ts           GET (list reminders)

app/api/cron/tax/
├── reminder/route.ts            Cron harian: cek jatuh tempo
└── bhp-uso/route.ts             Cron bulanan: kalkulasi BHP/USO
```

---

## 8. UI Pages

```
app/admin/pajak/
├── page.tsx                     Dashboard rekap pajak bulan ini
├── konfigurasi/page.tsx         Pengaturan (NPWP, tarif, PKP, dll)
├── [year]/[month]/page.tsx      Detail rekap bulan tertentu
├── transaksi/page.tsx           List transaksi pajak (filterable)
├── bhp-uso/page.tsx             Rekap BHP/USO tahunan
└── export/page.tsx              Export laporan pajak
```

### Menu Placement

Menu "Pajak" ditempatkan **sejajar** dengan "Akuntansi" di sidebar (bukan child), karena `modules/tax/` adalah modul independen:

```
Keuangan
├── Pendapatan Periode
├── Piutang
├── Pengeluaran
├── Kas & Bank
├── Laba Rugi
├── Akuntansi
│   ├── Jurnal
│   ├── Daftar Akun (COA)
│   ├── Periode
│   ├── Jurnal Berulang
│   ├── Rekonsiliasi Bank
│   └── Laporan
├── Pajak                    ← Modul terpisah, sejajar Akuntansi
│   ├── Dashboard
│   ├── Konfigurasi
│   ├── Transaksi
│   ├── BHP/USO
│   └── Export
```

### Frontend Template

Semua halaman UI modul pajak wajib mengikuti design system hybrid yang sudah diterapkan di modul akuntansi:

- Container: `p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]`
- Header: icon badge `bg-indigo-100 dark:bg-indigo-900/30 rounded-xl` + `font-black`
- Hero card: `bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl` + blur decoration
- Cards: `bg-white dark:bg-[#1e293b] rounded-2xl border shadow-sm`
- Table: `rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none`
- Buttons: `rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95`
- Semua label dalam **Bahasa Indonesia**

### TenantId & Data Isolation

Semua model tax (`TaxConfig`, `TaxTransaction`, `TaxPeriodSummary`, `TaxReminder`) memiliki field `tenantId` langsung — tenant isolation otomatis via Prisma extension. Tidak perlu exclude dari `ignoreModels`.

---

## 9. Cron Jobs

### Tax Reminder (harian, 08:00)
- Cek semua tenant yang punya TaxPeriodSummary BELUM_SETOR
- H-7 dari jatuh tempo → kirim reminder warning
- H-1 → kirim reminder urgent
- Lewat jatuh tempo → update status TERLAMBAT, hitung denda

### BHP/USO Monthly (tanggal 1, 02:00)
- Hitung total revenue bulan lalu dari jurnal POSTED
- Kalkulasi BHP dan USO
- Posting jurnal akrual
- Update TaxPeriodSummary

---

## 10. Denda & Kalkulasi

| Jenis | Jatuh Tempo | Denda |
|---|---|---|
| PPN | Tgl 15 bulan berikutnya | 1% per bulan dari kurang bayar |
| PPh 21 | Tgl 10 bulan berikutnya | 2% per bulan (max 24 bulan) |
| PPh 23 | Tgl 10 bulan berikutnya | 2% per bulan (max 24 bulan) |
| BHP/USO | April tahun berikutnya | Sesuai ketentuan Kominfo |

---

## 11. Integration Points

| Modul Source | Event | Tax Action |
|---|---|---|
| Finance (Billing) | INVOICE_CREATED | PPN Keluaran |
| Finance (Expense) | EXPENSE_APPROVED | PPN Masukan + PPh 23/4(2) |
| Finance (PO) | PURCHASE_ORDER_PAID | PPN Masukan |
| Salary | SALARY_PROCESSED (baru) | PPh 21 |
| Accounting (Journal) | Query revenue | BHP/USO calculation |

### Perubahan di Modul Existing:
1. **Expense model** — tambah field `hasPpnFaktur: Boolean` dan `pphCategory: String?`
2. **Salary module** — publish event `SALARY_PROCESSED`
3. **COA seed** — tambahkan akun pajak
4. **Menu config** — tambah submenu "Pajak" di bawah Akuntansi
5. **Event types** — tambah `SALARY_PROCESSED` ke EVENT_NAMES

---

## 12. Permission

```typescript
{ resource: "tax", actions: ["read", "manage"], label: "Pajak" }
```

---

## 13. Regulasi Telekomunikasi

### BHP (Biaya Hak Penyelenggaraan)
- Dasar: PP No. 7/2009, Permen Kominfo No. 5/2021
- Tarif: 0.5% dari pendapatan kotor
- Setor: paling lambat 30 April tahun berikutnya

### USO (Universal Service Obligation)
- Dasar: PP No. 7/2009
- Tarif: 1.25% dari pendapatan kotor
- Setor: paling lambat 30 April tahun berikutnya
- Dikelola oleh BAKTI

### KSO (Kerjasama Operasi)
- Berlaku jika ISP menggunakan infrastruktur pihak lain
- Persentase bagi hasil sesuai perjanjian
- Dicatat sebagai beban operasional

---

## 14. Urutan Implementasi

| Phase | Scope | Estimasi |
|---|---|---|
| 1 | Schema + TaxConfig + COA seed pajak | 1 hari |
| 2 | PpnService + event handler invoice | 1 hari |
| 3 | PphService + event handler expense/salary | 1 hari |
| 4 | BhpUsoService + cron | 0.5 hari |
| 5 | TaxPeriodService + rekap UI | 1 hari |
| 6 | TaxReminderService + cron + notifikasi | 0.5 hari |
| 7 | Export CSV/PDF | 0.5 hari |
| 8 | UI halaman konfigurasi + transaksi | 1 hari |
| 9 | Testing + integrasi end-to-end | 1 hari |

**Total estimasi: ~8 hari kerja**
