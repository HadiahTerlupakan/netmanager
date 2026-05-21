# Design Specification: Investor Module Enhancement

**Versi**: 1.0  
**Tanggal**: 2026-05-21  
**Author**: agent  
**Status**: Draft

---

## 1. Ringkasan

Modul investor saat ini hanya mendukung CRUD investor dan pencairan (payout). Spec ini mendefinisikan enhancement untuk menambah:

1. **Pencatatan setoran masuk (deposit)** — dengan jurnal otomatis ke accounting
2. **Tracking saldo per investor** — modal, payout, saldo aktif, persentase kepemilikan
3. **Bagi hasil (profit sharing)** — kalkulasi, approval, pembayaran, jurnal otomatis
4. **Laporan** — rekap setoran, bagi hasil, posisi modal
5. **UI pages** — admin dan portal investor

---

## 2. Database Schema

### 2.1 Model Baru

#### `InvestorDeposit`

```prisma
model InvestorDeposit {
  id            String               @id @default(uuid())
  investorId    String
  amount        BigInt
  depositType   InvestorDepositType
  date          DateTime
  bankName      String?
  accountNumber String?
  accountName   String?
  reference     String?
  notes         String?
  proofFileUrl  String?              // URL bukti transfer
  status        InvestorDepositStatus @default(PENDING)
  verifiedAt    DateTime?
  verifiedById  String?              // userId admin yang verifikasi
  completedAt   DateTime?
  rejectedAt    DateTime?
  rejectedReason String?
  journalId     String?              // FK ke JournalEntry setelah COMPLETED
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  tenantId      String?

  investor      Investor             @relation(fields: [investorId], references: [id])
  tenant        Tenant?              @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([investorId])
  @@index([tenantId])
  @@index([status])
  @@index([date])
}

enum InvestorDepositType {
  MODAL_AWAL
  TAMBAHAN_MODAL
  PINJAMAN
}

enum InvestorDepositStatus {
  PENDING
  VERIFIED
  COMPLETED
  REJECTED
}
```

#### `InvestorProfitShare`

```prisma
model InvestorProfitShare {
  id              String                   @id @default(uuid())
  investorId      String
  configId        String
  periodStart     DateTime
  periodEnd       DateTime
  netProfit       BigInt                   // laba bersih periode
  sharePercent    Float                    // persentase yang digunakan
  shareAmount     BigInt                   // hasil kalkulasi
  status          InvestorProfitShareStatus @default(CALCULATED)
  approvedAt      DateTime?
  approvedById    String?
  paidAt          DateTime?
  paidById        String?
  payoutId        String?                  // FK ke InvestorPayout setelah PAID
  journalId       String?
  notes           String?
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt
  tenantId        String?

  investor        Investor                 @relation(fields: [investorId], references: [id])
  config          InvestorConfig           @relation(fields: [configId], references: [id])
  tenant          Tenant?                  @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([investorId])
  @@index([tenantId])
  @@index([status])
  @@index([periodStart, periodEnd])
}

enum InvestorProfitShareStatus {
  CALCULATED
  APPROVED
  PAID
  CANCELLED
}
```

#### `InvestorConfig`

```prisma
model InvestorConfig {
  id                  String                    @id @default(uuid())
  investorId          String                    @unique
  shareMode           InvestorShareMode         @default(PROPORTIONAL)
  fixedSharePercent   Float?                    // diisi jika shareMode = FIXED
  periodType          InvestorProfitPeriodType  @default(MONTHLY)
  isActive            Boolean                   @default(true)
  createdAt           DateTime                  @default(now())
  updatedAt           DateTime                  @updatedAt
  tenantId            String?

  investor            Investor                  @relation(fields: [investorId], references: [id])
  tenant              Tenant?                   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  profitShares        InvestorProfitShare[]

  @@index([tenantId])
}

enum InvestorShareMode {
  FIXED        // persentase tetap per investor
  PROPORTIONAL // proporsional berdasarkan modal disetor
}

enum InvestorProfitPeriodType {
  MONTHLY
  QUARTERLY
  YEARLY
}
```

### 2.2 Relasi Tambahan ke Model `Investor`

```prisma
// Tambahkan ke model Investor yang sudah ada:
deposits     InvestorDeposit[]
profitShares InvestorProfitShare[]
config       InvestorConfig?
```

### 2.3 Tambahan ke Model `Tenant`

```prisma
// Tambahkan ke model Tenant:
investorDeposits    InvestorDeposit[]
investorProfitShares InvestorProfitShare[]
investorConfigs     InvestorConfig[]
```

---

## 3. COA Additions

Akun baru yang perlu di-seed per tenant (via `prisma/seed` atau migration seed):

| Kode   | Nama                          | Type      | Subtype              | Normal Side | Cash Flow  |
|--------|-------------------------------|-----------|----------------------|-------------|------------|
| 2-600  | Hutang Investor               | LIABILITY | LONG_TERM_LIABILITY  | CREDIT      | FINANCING  |
| 5-810  | Beban Bagi Hasil Investor     | EXPENSE   | OTHER_EXPENSE        | DEBIT       | FINANCING  |

> Akun 1-120 (Kas/Bank), 3-100 (Modal Investor) diasumsikan sudah ada dari seed awal.

---

## 4. JournalSource Additions

Tambahkan ke enum `JournalSource` di schema:

```prisma
AUTO_INVESTOR_DEPOSIT_MODAL    // setoran modal (MODAL_AWAL / TAMBAHAN_MODAL)
AUTO_INVESTOR_DEPOSIT_PINJAMAN // setoran pinjaman
AUTO_INVESTOR_PROFIT_SHARE     // pembayaran bagi hasil
```

---

## 5. Module Structure

```
modules/investor/
├── domain/
│   └── index.ts                          # (sudah ada, tambah export types baru)
├── dto/
│   ├── index.ts                          # (sudah ada)
│   ├── InvestorDepositDto.ts             # BARU
│   ├── InvestorProfitShareDto.ts         # BARU
│   └── InvestorConfigDto.ts              # BARU
├── repositories/
│   ├── InvestorRepository.ts             # (sudah ada)
│   ├── InvestorPortalRepository.ts       # (sudah ada)
│   ├── InvestorDepositRepository.ts      # BARU
│   ├── InvestorProfitShareRepository.ts  # BARU
│   └── InvestorConfigRepository.ts       # BARU
├── services/
│   ├── InvestorAdminService.ts           # (sudah ada)
│   ├── InvestorPayoutAdminService.ts     # (sudah ada)
│   ├── InvestorPortalAuthService.ts      # (sudah ada)
│   ├── InvestorPortalDashboardService.ts # (sudah ada, perlu update)
│   ├── InvestorPortalPayoutService.ts    # (sudah ada)
│   ├── InvestorPortalProjectService.ts   # (sudah ada)
│   ├── InvestorDepositService.ts         # BARU
│   ├── InvestorProfitShareService.ts     # BARU
│   ├── InvestorConfigService.ts          # BARU
│   └── InvestorBalanceService.ts         # BARU
├── validators/
│   ├── InvestorDepositValidator.ts       # BARU
│   ├── InvestorProfitShareValidator.ts   # BARU
│   └── InvestorConfigValidator.ts        # BARU
├── handlers/
│   └── InvestorAccountingEventHandler.ts # BARU — publish jurnal otomatis
└── index.ts                              # (sudah ada, perlu update export)
```

---

## 6. Service Layer

### 6.1 `InvestorDepositService`

```typescript
class InvestorDepositService {
  // Admin: buat setoran baru (status PENDING)
  createDeposit(input: CreateDepositInput, actorId: string): Promise<Result<InvestorDeposit>>

  // Admin: verifikasi setoran (PENDING → VERIFIED)
  verifyDeposit(depositId: string, actorId: string): Promise<Result<InvestorDeposit>>

  // Admin: selesaikan setoran (VERIFIED → COMPLETED) — trigger event jurnal
  completeDeposit(depositId: string, actorId: string): Promise<Result<InvestorDeposit>>

  // Admin: tolak setoran (PENDING/VERIFIED → REJECTED)
  rejectDeposit(depositId: string, reason: string, actorId: string): Promise<Result<InvestorDeposit>>

  // Query
  getDepositsByInvestor(investorId: string, pagination: PaginationInput): Promise<PaginatedResult<InvestorDeposit>>
  getDepositById(depositId: string): Promise<InvestorDeposit | null>
  getPendingDeposits(tenantId: string, pagination: PaginationInput): Promise<PaginatedResult<InvestorDeposit>>
}
```

**State machine deposit:**
```
PENDING → VERIFIED → COMPLETED
PENDING → REJECTED
VERIFIED → REJECTED
```

### 6.2 `InvestorBalanceService`

```typescript
class InvestorBalanceService {
  // Hitung saldo satu investor
  getInvestorBalance(investorId: string): Promise<InvestorBalance>

  // Hitung saldo semua investor dalam satu tenant
  getAllInvestorBalances(tenantId: string): Promise<InvestorBalance[]>
}

interface InvestorBalance {
  investorId: string
  namaLengkap: string
  totalDeposit: bigint        // sum(InvestorDeposit.amount WHERE status=COMPLETED)
  totalPayout: bigint         // sum(InvestorPayout.amount)
  totalProfitSharePaid: bigint // sum(InvestorProfitShare.shareAmount WHERE status=PAID)
  activeBalance: bigint       // totalDeposit - totalPayout - totalProfitSharePaid
  ownershipPercent: number    // totalDeposit / sum(semua investor totalDeposit) * 100
}
```

### 6.3 `InvestorProfitShareService`

```typescript
class InvestorProfitShareService {
  // Admin: kalkulasi bagi hasil untuk semua investor aktif satu periode
  calculateProfitShares(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    netProfit: bigint,
    actorId: string
  ): Promise<Result<InvestorProfitShare[]>>

  // Admin: approve bagi hasil (CALCULATED → APPROVED)
  approveProfitShare(profitShareId: string, actorId: string): Promise<Result<InvestorProfitShare>>

  // Admin: bayar bagi hasil (APPROVED → PAID) — buat InvestorPayout + trigger event jurnal
  payProfitShare(
    profitShareId: string,
    paymentDetails: PaymentDetails,
    actorId: string
  ): Promise<Result<InvestorProfitShare>>

  // Query
  getProfitSharesByInvestor(investorId: string, pagination: PaginationInput): Promise<PaginatedResult<InvestorProfitShare>>
  getProfitSharesByPeriod(tenantId: string, periodStart: Date, periodEnd: Date): Promise<InvestorProfitShare[]>
}
```

**Logika kalkulasi:**
- `shareMode = PROPORTIONAL`: `shareAmount = netProfit × (investorTotalDeposit / totalAllDeposits)`
- `shareMode = FIXED`: `shareAmount = netProfit × (config.fixedSharePercent / 100)`

### 6.4 `InvestorConfigService`

```typescript
class InvestorConfigService {
  upsertConfig(investorId: string, input: InvestorConfigInput, actorId: string): Promise<Result<InvestorConfig>>
  getConfigByInvestor(investorId: string): Promise<InvestorConfig | null>
}
```

---

## 7. Event Handlers

### 7.1 Events yang Dipublish

```typescript
// Di InvestorDepositService.completeDeposit():
eventBus.publish('investor.deposit.completed', {
  depositId: string
  investorId: string
  tenantId: string
  amount: string
  depositType: InvestorDepositType
  completedAt: string
})

// Di InvestorProfitShareService.payProfitShare():
// Reuse event yang sudah ada:
eventBus.publish(EVENT_NAMES.INVESTOR_PAYOUT_COMPLETED, {
  payoutId: string
  tenantId: string
  investorId: string
  amount: string
  completedAt: string
})
```

### 7.2 `InvestorAccountingEventHandler`

Handler baru yang subscribe ke `investor.deposit.completed`:

```typescript
// File: modules/investor/handlers/InvestorAccountingEventHandler.ts

class InvestorAccountingEventHandler {
  async handleDepositCompleted(payload: InvestorDepositCompletedPayload): Promise<void> {
    const { depositId, tenantId, amount, depositType } = payload

    if (depositType === 'MODAL_AWAL' || depositType === 'TAMBAHAN_MODAL') {
      // DR Kas/Bank (1-120) / CR Modal Investor (3-100)
      await this.accountingBridge.createJournal({
        tenantId,
        source: 'AUTO_INVESTOR_DEPOSIT_MODAL',
        description: `Setoran modal investor — ${depositId}`,
        lines: [
          { coaCode: '1-120', debitCredit: 'DEBIT',  amount },
          { coaCode: '3-100', debitCredit: 'CREDIT', amount },
        ],
        refId: depositId,
      })
    } else if (depositType === 'PINJAMAN') {
      // DR Kas/Bank (1-120) / CR Hutang Investor (2-600)
      await this.accountingBridge.createJournal({
        tenantId,
        source: 'AUTO_INVESTOR_DEPOSIT_PINJAMAN',
        description: `Setoran pinjaman investor — ${depositId}`,
        lines: [
          { coaCode: '1-120', debitCredit: 'DEBIT',  amount },
          { coaCode: '2-600', debitCredit: 'CREDIT', amount },
        ],
        refId: depositId,
      })
    }
  }
}
```

> Jurnal untuk payout/bagi hasil sudah ditangani oleh handler `AUTO_INVESTOR_PAYOUT` yang ada. Tidak perlu handler baru untuk profit share — cukup reuse event `INVESTOR_PAYOUT_COMPLETED`.

---

## 8. API Routes

### 8.1 Admin Routes

```
# Deposit
POST   /api/admin/investor/[id]/deposits          — buat setoran baru
GET    /api/admin/investor/[id]/deposits          — list setoran investor
GET    /api/admin/investor/deposits/pending       — semua setoran pending (approval queue)
PATCH  /api/admin/investor/deposits/[depositId]/verify   — verifikasi
PATCH  /api/admin/investor/deposits/[depositId]/complete — selesaikan
PATCH  /api/admin/investor/deposits/[depositId]/reject   — tolak

# Saldo
GET    /api/admin/investor/[id]/balance           — saldo satu investor
GET    /api/admin/investor/balances               — saldo semua investor

# Bagi Hasil
POST   /api/admin/investor/profit-shares/calculate — kalkulasi periode
GET    /api/admin/investor/profit-shares          — list semua bagi hasil
GET    /api/admin/investor/[id]/profit-shares     — bagi hasil per investor
PATCH  /api/admin/investor/profit-shares/[id]/approve — approve
PATCH  /api/admin/investor/profit-shares/[id]/pay     — bayar

# Konfigurasi
GET    /api/admin/investor/[id]/config            — ambil konfigurasi
PUT    /api/admin/investor/[id]/config            — simpan konfigurasi

# Laporan
GET    /api/admin/investor/reports/deposits       — rekap setoran
GET    /api/admin/investor/reports/profit-shares  — rekap bagi hasil
GET    /api/admin/investor/reports/capital        — posisi modal
```

### 8.2 Portal Investor Routes

```
GET    /api/investor/portal/deposits              — riwayat setoran milik sendiri
GET    /api/investor/portal/balance               — saldo aktif milik sendiri
GET    /api/investor/portal/profit-shares         — riwayat bagi hasil milik sendiri
```

---

## 9. UI Pages

### 9.1 Admin Pages

#### `/admin/investor/[id]` — Halaman Detail Investor (update existing)

Tambah dua tab baru di halaman detail yang sudah ada:

- **Tab: Setoran** — tabel riwayat setoran + tombol "Tambah Setoran"
- **Tab: Bagi Hasil** — tabel riwayat bagi hasil + status (CALCULATED/APPROVED/PAID)
- **Tab: Konfigurasi** — form konfigurasi share mode + periode

#### `/admin/investor/deposits` — Approval Queue (halaman baru)

- Tabel setoran berstatus PENDING dan VERIFIED
- Kolom: investor, jumlah, jenis, tanggal, bukti transfer, aksi (Verifikasi / Selesaikan / Tolak)
- Filter: status, tanggal, investor

#### `/admin/investor/profit-shares` — Manajemen Bagi Hasil (halaman baru)

- Form kalkulasi: pilih periode + input laba bersih → preview hasil per investor
- Tabel hasil kalkulasi dengan aksi Approve dan Bayar
- Filter: periode, status, investor

#### `/admin/investor/reports` — Laporan (halaman baru)

- Tab: Rekap Setoran — tabel per investor, total modal, breakdown per jenis
- Tab: Rekap Bagi Hasil — tabel per investor, total dibayar, outstanding
- Tab: Posisi Modal — tabel neraca modal investor (saldo aktif + persentase kepemilikan)
- Tombol Export CSV dan Export PDF per tab

### 9.2 Portal Investor Pages

#### `/investor/portal/dashboard` — Update existing

Tambah section ringkasan:
- Kartu: Total Modal Disetor
- Kartu: Total Bagi Hasil Diterima
- Kartu: Saldo Aktif

#### `/investor/portal/deposits` — Halaman baru

- Tabel riwayat setoran milik sendiri
- Kolom: tanggal, jumlah, jenis, status, referensi

#### `/investor/portal/profit-shares` — Halaman baru

- Tabel riwayat bagi hasil
- Kolom: periode, laba bersih, persentase, jumlah, status, tanggal bayar

---

## 10. Urutan Implementasi

### Fase 1 — Foundation (Database + Core Services)

1. **Migration Prisma** — tambah model `InvestorDeposit`, `InvestorProfitShare`, `InvestorConfig` + enum baru + `JournalSource` baru
2. **COA Seed** — tambah akun 2-600 dan 5-810 ke seed data
3. **Repositories** — `InvestorDepositRepository`, `InvestorProfitShareRepository`, `InvestorConfigRepository`
4. **Validators** — Zod schema untuk input deposit, profit share, config

### Fase 2 — Business Logic

5. **`InvestorDepositService`** — CRUD + state machine (PENDING → VERIFIED → COMPLETED/REJECTED)
6. **`InvestorBalanceService`** — kalkulasi saldo dan persentase kepemilikan
7. **`InvestorConfigService`** — upsert konfigurasi bagi hasil
8. **`InvestorProfitShareService`** — kalkulasi, approval, pembayaran

### Fase 3 — Accounting Integration

9. **`InvestorAccountingEventHandler`** — subscribe `investor.deposit.completed`, publish jurnal otomatis
10. **Register handler** di event bus (BullMQ worker)
11. **Update `JournalSource` enum** di schema + regenerate Prisma client

### Fase 4 — API Layer

12. **Admin API routes** — deposit CRUD + approval, balance, profit share, config, reports
13. **Portal API routes** — read-only untuk investor sendiri

### Fase 5 — UI

14. **Update halaman detail investor** — tambah tab Setoran, Bagi Hasil, Konfigurasi
15. **Halaman approval queue** `/admin/investor/deposits`
16. **Halaman manajemen bagi hasil** `/admin/investor/profit-shares`
17. **Halaman laporan** `/admin/investor/reports`
18. **Update portal dashboard** — tambah kartu ringkasan modal
19. **Portal pages** — `/investor/portal/deposits` dan `/investor/portal/profit-shares`

### Fase 6 — Verifikasi

20. **Unit tests** — `InvestorDepositService`, `InvestorBalanceService`, `InvestorProfitShareService`
21. **Integration tests** — alur deposit PENDING → COMPLETED + jurnal terbuat
22. **Integration tests** — alur profit share CALCULATED → PAID + payout terbuat

---

## 11. Asumsi & Risiko

| Item | Keterangan |
|------|-----------|
| Upload bukti transfer | Gunakan pattern upload yang sudah ada di project (simpan URL di `proofFileUrl`) |
| Akun COA 1-120, 3-100 | Diasumsikan sudah ada di seed; jika belum, tambahkan ke seed sebelum Fase 3 |
| Laba bersih untuk kalkulasi | Diinput manual oleh admin per periode; integrasi otomatis dari accounting report bisa jadi enhancement berikutnya |
| Multi-tenant | Semua query wajib filter `tenantId`; `InvestorConfig` scoped per investor per tenant |
| Idempotency event handler | Handler `handleDepositCompleted` wajib cek apakah `journalId` sudah terisi sebelum buat jurnal baru |
| Payout existing | `InvestorPayout` yang sudah ada tetap digunakan untuk profit share payment — tidak ada model baru untuk pembayaran |

---

*Spec ini siap digunakan sebagai dasar implementasi. Mulai dari Fase 1 (migration) untuk memastikan foundation database solid sebelum masuk ke business logic.*
