# Modul Akuntansi (Accounting) — Design Document

- **Date**: 2026-05-20
- **Status**: Draft (awaiting user review)
- **Author**: agent + @rohadi
- **Scope**: New module `modules/accounting/` untuk pembukuan standar (double-entry) dengan auto-journal dari `finance` via outbox pattern.

---

## 1. Latar Belakang & Tujuan

### Masalah
Project ini mengelola pelanggan PPP yang menghasilkan pendapatan (Invoice + Payment) dan pengeluaran operasional (Expense, PurchaseOrder, RAB). Komponen-komponen ini sudah tersebar di module `finance`, tetapi:

- Tidak ada **single source of truth** akuntansi untuk akuntan.
- Tidak ada **double-entry** — `FinancialAccount.balance` di-update ad-hoc tanpa journal trail.
- Tidak ada **Chart of Accounts** terstruktur.
- Laporan terbatas (`laba-rugi` sederhana, `pendapatan-harian/periode`); tidak ada Neraca, Arus Kas, Trial Balance.
- Tidak ada **period closing**, **recurring journal**, **bank reconciliation** standar akuntansi.

### Tujuan v1
Menyediakan modul akuntansi standar (PSAK-aligned, tidak terlalu ribet) untuk akuntan internal, mencakup:

1. Chart of Accounts (COA) dengan hirarki + COA default per tenant.
2. Double-entry journal (auto-post dari transaksi `finance` + manual entry untuk adjustment).
3. Empat laporan inti: Buku Kas & Bank, Laba Rugi, Neraca, Arus Kas.
4. Tools akuntan: period closing, recurring journal, journal reversal, bank reconciliation.
5. Migrasi data: opening balance manual, mulai dari tanggal cutover (tidak backfill historis).

### Non-Goals (v1)
Lihat **Section 6 — Roadmap Pasca-v1**. Item yang ditahan untuk v1: multi-currency, e-Faktur/e-Bupot, tax reporting khusus, fixed asset depreciation otomatis (tetap manual via recurring journal), approval workflow manual journal, konsolidasi multi-tenant, export ke vendor (Accurate/Zahir/MYOB), backfill historis, cost center.

---

## 2. Arsitektur Tinggi

### 2.1. Module Baru: `modules/accounting/`

Mengikuti Clean Architecture standar project (`docs/architecture/clean-architecture.md`):

```
modules/accounting/
├── domain/
│   ├── entities/              # ChartOfAccount, JournalEntry, JournalLine, AccountingPeriod
│   ├── value-objects/         # Money (Decimal-safe), DebitCredit, AccountCode
│   └── ports/                 # Interface repositories
├── dto/                       # Request/response DTOs
├── repositories/              # Prisma access layer
├── services/
│   ├── coa/                   # COA management
│   ├── journal/               # Journal posting (auto + manual)
│   ├── period/                # Period close/reopen
│   ├── recurring/             # Recurring journal scheduler
│   ├── reconciliation/        # Bank reconciliation
│   ├── reports/               # Trial Balance, P&L, Balance Sheet, Cash Flow
│   └── event-handlers/        # Subscribers ke events dari finance
├── validators/                # Zod schemas
├── mappers/                   # Entity ↔ DTO
└── index.ts                   # Public API
```

### 2.2. Komunikasi `finance` → `accounting`: Outbox Pattern

**Kenapa outbox**: in-memory event bus tidak reliable — kalau handler crash, journal hilang. Outbox memastikan **transactional consistency** antara transaksi sumber dan jurnal akuntansi.

**Flow**:

1. Service `finance` (misal `PaymentRouteService.create`) menjalankan logic operasional + insert event ke `accounting_outbox` (status=PENDING) dalam **1 DB transaction**.
2. Worker `AccountingOutboxProcessor` baca outbox secara periodik, translate event jadi `JournalEntry` + `JournalLine` sesuai mapping COA, post ke GL.
3. Setelah berhasil post, mark outbox event = PROCESSED. Idempotent via `eventId` unik.
4. Kalau gagal, retry dengan exponential backoff. Setelah N kali, masuk dead-letter queue + alert akuntan.

**Konsekuensi**:
- Konsistensi: jurnal **tidak akan pernah hilang** selama transaksi finance commit.
- Eventual: ada lag detik-an antara transaksi finance vs jurnal muncul di GL — acceptable untuk akuntan.
- Tidak butuh Kafka/Redis Streams — cukup tabel Postgres + cron worker (pattern serupa sudah ada di `BillingScheduleService`).

### 2.3. Boundary Integrity

- `accounting` **tidak pernah** import dari `finance` services — hanya consume events + read-only DTO via `FinanceRepositoryFacade` jika perlu enrichment.
- `finance` **tidak pernah** import dari `accounting`.
- Semua komunikasi via event + outbox.

---

## 3. Data Model

Semua model di-prefix tenant via `tenantId` (multi-tenant). Amount pakai `Decimal(19,2)` — bukan `Float` (akurasi) atau `BigInt` (butuh konversi manual).

### 3.1. `ChartOfAccount` — pohon akun (COA)

```prisma
model ChartOfAccount {
  id          String          @id @default(cuid())
  tenantId    String
  code        String          // "1-100", "1-110", dst
  name        String          // "Kas Kecil", "Bank BCA", "Pendapatan PPP"
  type        COAType         // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  subtype     COASubtype?     // CURRENT_ASSET, FIXED_ASSET, COGS, OPEX, dst
  normalSide  DebitCredit     // DEBIT untuk ASSET/EXPENSE, CREDIT untuk LIABILITY/EQUITY/REVENUE
  cashFlowCategory CashFlowCategory? // OPERATING, INVESTING, FINANCING, null
  parentId    String?
  isPostable  Boolean         @default(true)  // false untuk header/group account
  isSystem    Boolean         @default(false) // true = tidak boleh dihapus
  isActive    Boolean         @default(true)
  description String?
  parent      ChartOfAccount?  @relation("CoaTree", fields: [parentId], references: [id])
  children    ChartOfAccount[] @relation("CoaTree")
  lines       JournalLine[]

  @@unique([tenantId, code])
  @@index([tenantId, type])
  @@map("chart_of_accounts")
}

enum COAType { ASSET LIABILITY EQUITY REVENUE EXPENSE }
enum COASubtype { CURRENT_ASSET FIXED_ASSET CURRENT_LIABILITY LONG_TERM_LIABILITY CONTRIBUTED_CAPITAL RETAINED_EARNINGS OPERATING_REVENUE OTHER_REVENUE COGS OPEX OTHER_EXPENSE }
enum DebitCredit { DEBIT CREDIT }
enum CashFlowCategory { OPERATING INVESTING FINANCING }
```

### 3.2. `JournalEntry` — header jurnal

```prisma
model JournalEntry {
  id            String          @id @default(cuid())
  tenantId      String
  entryNumber   String          // "JV-2026-05-0001"
  entryDate     DateTime        // tanggal efektif transaksi
  periodId      String
  source        JournalSource
  sourceRefType String?         // "Invoice", "Payment", "Expense", null untuk manual
  sourceRefId   String?         // FK lunak ke entitas sumber
  description   String
  status        JournalStatus
  reversalOfId  String?         @unique
  postedAt      DateTime?
  postedBy      String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  period        AccountingPeriod @relation(fields: [periodId], references: [id])
  lines         JournalLine[]
  reversalOf    JournalEntry?    @relation("JournalReversal", fields: [reversalOfId], references: [id])
  reversedBy    JournalEntry?    @relation("JournalReversal")

  @@unique([tenantId, entryNumber])
  @@index([tenantId, entryDate])
  @@index([tenantId, source, sourceRefId])  // idempotency check
  @@index([periodId, status])
  @@map("journal_entries")
}

enum JournalSource { AUTO_INVOICE_PAID AUTO_INVOICE_CREATED AUTO_PAYMENT AUTO_EXPENSE AUTO_PO_PAID MANUAL RECURRING REVERSAL OPENING_BALANCE ADJUSTMENT CLOSING }
enum JournalStatus { DRAFT POSTED REVERSED }
```

### 3.3. `JournalLine` — detail debit/kredit

```prisma
model JournalLine {
  id          String         @id @default(cuid())
  entryId     String
  coaId       String
  side        DebitCredit
  amount      Decimal        @db.Decimal(19, 2)  // positif; side menentukan D/K
  description String?
  lineOrder   Int
  entry       JournalEntry   @relation(fields: [entryId], references: [id], onDelete: Cascade)
  coa         ChartOfAccount @relation(fields: [coaId], references: [id])

  @@index([entryId])
  @@index([coaId])
  @@map("journal_lines")
}
```

**Invariant kritikal** (di-enforce di service layer + DB trigger DEFERRED):
`SUM(amount WHERE side=DEBIT) == SUM(amount WHERE side=CREDIT)` per JournalEntry.

### 3.4. `AccountingPeriod` — periode buku

```prisma
model AccountingPeriod {
  id        String         @id @default(cuid())
  tenantId  String
  year      Int
  month     Int            // 1-12
  status    PeriodStatus
  closedAt  DateTime?
  closedBy  String?
  startDate DateTime
  endDate   DateTime
  entries   JournalEntry[]

  @@unique([tenantId, year, month])
  @@index([tenantId, status])
  @@map("accounting_periods")
}

enum PeriodStatus { OPEN CLOSING CLOSED REOPENED }
```

### 3.5. `RecurringJournalTemplate`

```prisma
model RecurringJournalTemplate {
  id            String           @id @default(cuid())
  tenantId      String
  name          String
  description   String?
  frequency     RecurringFreq    // MONTHLY, QUARTERLY, YEARLY
  dayOfMonth    Int              // 1-28 (hindari 29-31)
  startDate     DateTime
  endDate       DateTime?
  templateLines Json             // [{ coaId, side, amount, description }, ...]
  isActive      Boolean          @default(true)
  lastGeneratedAt DateTime?

  @@index([tenantId, isActive, dayOfMonth])
  @@map("recurring_journal_templates")
}

enum RecurringFreq { MONTHLY QUARTERLY YEARLY }
```

### 3.6. `AccountingOutbox`

```prisma
model AccountingOutbox {
  id          String        @id @default(cuid())
  tenantId    String
  eventType   String
  eventId     String        @unique  // idempotency key
  payload     Json
  status      OutboxStatus
  attempts    Int           @default(0)
  lastError   String?
  scheduledAt DateTime      @default(now())
  processedAt DateTime?
  resultJournalEntryId String?

  @@index([status, scheduledAt])
  @@index([tenantId, eventType])
  @@map("accounting_outbox")
}

enum OutboxStatus { PENDING PROCESSING PROCESSED FAILED DEAD }
```

### 3.7. `BankReconciliation` + `BankReconciliationLine`

```prisma
model BankReconciliation {
  id                 String                @id @default(cuid())
  tenantId           String
  coaId              String                // akun bank yang direkon
  statementDate      DateTime
  statementBalance   Decimal               @db.Decimal(19, 2)
  bookBalance        Decimal               @db.Decimal(19, 2)
  reconciledBalance  Decimal               @db.Decimal(19, 2)
  status             ReconStatus
  completedAt        DateTime?
  completedBy        String?
  lines              BankReconciliationLine[]

  @@index([tenantId, coaId, statementDate])
  @@map("bank_reconciliations")
}

model BankReconciliationLine {
  id              String              @id @default(cuid())
  reconciliationId String
  journalLineId   String?             // matched dengan jurnal (nullable)
  bankRefDate     DateTime
  bankRefDescription String
  bankRefAmount   Decimal             @db.Decimal(19, 2)
  matchStatus     MatchStatus
  reconciliation  BankReconciliation  @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)

  @@index([reconciliationId, matchStatus])
  @@map("bank_reconciliation_lines")
}

enum ReconStatus { DRAFT COMPLETED }
enum MatchStatus { MATCHED UNMATCHED MANUAL_MATCH }
```

### 3.8. Extension ke Model Existing (additive nullable)

- `ExpenseCategory.coaId` (nullable) — link ke COA EXPENSE; default `5-500 Beban Lain-lain` jika belum di-mapping.
- `FinancialAccount.coaId` (nullable) — link 1:1 ke child COA di bawah `1-100 Kas` atau `1-110 Bank`.

Tidak ada perubahan field existing. Hanya tambah kolom nullable.

---

## 4. Auto-Journal Mapping & Alur Outbox

### 4.1. COA Default (auto-seed per tenant)

Akuntan bisa modify, tapi `isSystem=true` tidak bisa dihapus karena di-reference auto-mapping.

| Code  | Nama                         | Type      | System |
|-------|------------------------------|-----------|--------|
| 1-100 | Kas                          | ASSET     | Yes    |
| 1-110 | Bank (parent)                | ASSET     | Yes    |
| 1-200 | Piutang Usaha (AR)           | ASSET     | Yes    |
| 1-300 | Persediaan                   | ASSET     |        |
| 1-400 | Aset Tetap                   | ASSET     |        |
| 1-410 | Akumulasi Penyusutan         | ASSET     |        |
| 2-100 | Utang Usaha (AP)             | LIABILITY | Yes    |
| 2-200 | Utang Pajak                  | LIABILITY |        |
| 3-100 | Modal Disetor                | EQUITY    | Yes    |
| 3-200 | Laba Ditahan                 | EQUITY    | Yes    |
| 3-300 | Laba/Rugi Berjalan           | EQUITY    | Yes    |
| 4-100 | Pendapatan Layanan PPP       | REVENUE   | Yes    |
| 4-200 | Pendapatan Lain-lain         | REVENUE   |        |
| 5-100 | Beban Bandwidth              | EXPENSE   |        |
| 5-200 | Beban Gaji                   | EXPENSE   |        |
| 5-300 | Beban Operasional            | EXPENSE   |        |
| 5-400 | Beban Penyusutan             | EXPENSE   |        |
| 5-500 | Beban Lain-lain              | EXPENSE   | Yes    |

### 4.2. Mapping Auto-Journal per Event

**`invoice.created` (accrual basis)**
```
DR  Piutang Usaha (1-200)              Rp X
    CR  Pendapatan Layanan PPP (4-100)     Rp X
```

**`invoice.paid`**
```
DR  Bank/Kas (sesuai akun penerima)    Rp X
    CR  Piutang Usaha (1-200)              Rp X
```

Dengan fee gateway:
```
DR  Bank                               Rp (X - fee)
DR  Beban Biaya Admin Gateway          Rp fee
    CR  Piutang Usaha (1-200)              Rp X
```

**`expense.created`** (Expense disetujui & dibayar)
```
DR  Beban (sesuai ExpenseCategory.coaId)    Rp X
    CR  Bank/Kas (sesuai accountId)             Rp X
```

**`purchase_order.paid`** (v1: simplifikasi → Persediaan)
```
DR  Persediaan (1-300) / Aset Tetap (1-400)    Rp X
    CR  Bank/Kas                                   Rp X
```

**`payment.refund` / `invoice.void`**
Generate journal reversal otomatis (kebalikan dari auto-journal asli).

### 4.3. Alur Outbox Processor

```
[finance service]
   │
   │  1 DB transaction
   ▼
INSERT Payment + INSERT AccountingOutbox(eventId="payment-uuid", status=PENDING)
   │
   │ COMMIT
   ▼
[AccountingOutboxProcessor — cron tiap 30 detik]
   │
   ├─> 1. SELECT * FROM accounting_outbox WHERE status=PENDING
   │      ORDER BY scheduled_at LIMIT 100 FOR UPDATE SKIP LOCKED
   ├─> 2. status → PROCESSING, attempts++
   ├─> 3. Resolve mapping (eventType → handler), generate JournalEntry + Lines
   ├─> 4. Validate balance (DR = CR), validate period status (must OPEN)
   ├─> 5. INSERT JournalEntry POSTED, link resultJournalEntryId
   ├─> 6. status → PROCESSED
   └─> Error:
         - attempts < 5: status → PENDING, scheduledAt = now() + backoff(attempts)
         - attempts >= 5: status → DEAD, notif akuntan
```

**Idempotency**: cek `JournalEntry.source + sourceRefId` sebelum insert — kalau sudah ada, skip (handle worker restart).

**Period CLOSED**: jurnal di-flag `requires_manual_handling`, masuk DEAD queue + notif. Akuntan harus reopen periode atau buat adjustment di periode berjalan.

### 4.4. Manual Journal Entry

Form sederhana di UI:
- Pilih tanggal efektif → sistem cek period harus OPEN.
- Tambah baris debit/kredit (minimal 2 baris).
- Realtime balance check (DR total = CR total) — submit di-disable kalau tidak balance.
- Optional: lampiran file (pakai existing file upload).
- Submit → langsung POSTED.

### 4.5. Recurring Journal Engine

Cron harian jam 01:00 lokal:
1. Query template `isActive=true` WHERE `dayOfMonth = today.day` AND `lastGeneratedAt < today.startOfMonth`.
2. Clone `templateLines` → JournalEntry baru, `source=RECURRING`, `status=POSTED`.
3. Update `lastGeneratedAt`.

Use case: depresiasi, sewa kantor, akrual gaji.

---

## 5. Laporan Akuntansi, Period Closing & Bank Reconciliation

### 5.1. Laporan dari General Ledger

Dihitung **on-the-fly** dari `JournalLine` join `ChartOfAccount` & `JournalEntry`. Tidak ada denormalisasi balance per akun di v1. Materialized view ditambahkan jika volume > 1 juta baris/bulan.

#### Trial Balance (foundation)

```sql
SELECT
  coa.code, coa.name, coa.type, coa.normal_side,
  SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END) AS total_debit,
  SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END) AS total_credit
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.entry_id
JOIN chart_of_accounts coa ON coa.id = jl.coa_id
WHERE je.tenant_id = ? AND je.status = 'POSTED' AND je.entry_date <= ?
GROUP BY coa.code, coa.name, coa.type, coa.normal_side
ORDER BY coa.code;
```

Service: `TrialBalanceService.generate(asOfDate, tenantId)`. Wajib check `SUM(total_debit) == SUM(total_credit)` di seluruh trial balance — kalau tidak balance, alert akuntan + log critical.

#### Buku Kas & Bank
Filter Trial Balance untuk `type=ASSET, subtype IN (CASH, BANK, EWALLET)` + mutation listing per akun.

#### Laba Rugi
```
Pendapatan (sum REVENUE)                              Rp XXX
Beban (sum EXPENSE)                                   (Rp XXX)
─────────────────────────────────────────────────────
Laba/Rugi Bersih                                       Rp XXX
```

#### Neraca
```
ASET                                LIABILITAS & EKUITAS
  Aset Lancar                         Liabilitas
    Kas, Bank, Piutang, Persediaan      Utang Usaha, Utang Pajak
  Aset Tetap                          Ekuitas
    Aset Tetap, (Akum. Penyusutan)      Modal Disetor, Laba Ditahan,
                                          Laba/Rugi Berjalan
TOTAL ASET = TOTAL LIABILITAS + EKUITAS  ← invariant
```

`Laba/Rugi Berjalan` di-compute on-the-fly. Saat period closing, di-roll ke `3-200 Laba Ditahan`.

#### Arus Kas (PSAK 2 — metode tidak langsung)

Setiap COA punya `cashFlowCategory` (OPERATING/INVESTING/FINANCING/null). Service agregat per kategori.

### 5.2. Period Closing (Tutup Buku)

**Flow**:
1. Akuntan klik "Tutup Buku — Mei 2026".
2. Sistem cek prasyarat:
   - Period status = OPEN.
   - Semua outbox event periode tsb sudah PROCESSED.
   - Trial Balance balance.
3. Period status → CLOSING (lock).
4. Generate **closing journal**:
   ```
   DR  Pendapatan (sum)            Rp X
       CR  Laba/Rugi Berjalan         Rp X

   DR  Laba/Rugi Berjalan          Rp Y
       CR  Beban (sum)                Rp Y

   DR  Laba/Rugi Berjalan          Rp (X-Y)
       CR  Laba Ditahan               Rp (X-Y)
   ```
5. Period status → CLOSED.
6. Period bulan berikutnya auto-create OPEN.

**Reopen** (untuk koreksi): permission `accounting:period:reopen` (default cuma owner/admin). Setelah koreksi, harus tutup ulang.

**Aturan jurnal di periode CLOSED**:
- Auto-journal: kalau `entryDate` di periode CLOSED → masuk DEAD queue.
- Manual journal: form di-disable.

### 5.3. Bank Reconciliation

**Flow**:
1. Akuntan pilih akun bank + tanggal statement.
2. Upload CSV mutasi bank atau input manual.
3. Sistem auto-match `JournalLine` di akun bank dalam window ±3 hari berdasarkan amount + description similarity.
4. UI 3 kolom: Matched (hijau), Unmatched bank, Unmatched book.
5. Akuntan review & klik "Complete Reconciliation".
6. Sistem hitung `reconciledBalance` vs `statementBalance` — harus sama.
7. Status → COMPLETED (immutable).

**Reuse**: existing `UnmatchedMutationService` di `finance` → handler-nya extend untuk auto-create reconciliation line.

### 5.4. UI Pages

```
/admin/akuntansi/
├── page.tsx                       # Dashboard: ringkasan saldo, P&L bulan ini, alert
├── coa/                           # Manage Chart of Accounts (tree view)
├── jurnal/
│   ├── page.tsx                   # List jurnal (filter)
│   ├── new/page.tsx               # Form manual journal entry
│   ├── [id]/page.tsx              # Detail + reverse button
│   └── recurring/page.tsx         # Manage recurring templates
├── periode/                       # List periode + tutup/buka buku
├── rekonsiliasi/                  # List reconciliation sessions + matching UI
└── laporan/
    ├── trial-balance/
    ├── laba-rugi/                 # Replace existing /admin/finance/laba-rugi
    ├── neraca/
    ├── arus-kas/
    └── buku-besar/                # General ledger per account
```

`/admin/finance/laba-rugi` di-redirect ke `/admin/akuntansi/laporan/laba-rugi` setelah module ready.

### 5.5. Authorization (RBAC)

Permission baru di `lib/permission-config.ts`:

```
accounting:read                # baca laporan + jurnal
accounting:journal:create      # buat manual journal entry
accounting:journal:reverse     # reverse journal
accounting:coa:manage          # CRUD COA
accounting:period:close        # tutup buku
accounting:period:reopen       # buka kembali (high-risk)
accounting:reconciliation      # bank reconciliation
accounting:recurring:manage    # CRUD recurring template
```

Default role mapping:
- **owner / super_admin**: semua.
- **akuntan** (role baru): semua kecuali `period:reopen`.
- **finance_staff** (existing): hanya `accounting:read`.
- **lainnya**: tidak ada akses.

---

## 6. Migration Plan, Testing & Rollout

### 6.1. Migration Plan (Production-Safe)

**Prinsip**: additive only, zero-downtime, reversible. Tidak ada `DROP COLUMN` / `ALTER TYPE` di v1.

#### Migration sequence (8 file)

| # | Nama Migration | Konten | Risiko |
|---|----------------|--------|--------|
| 1 | `add_accounting_enums` | Enum `COAType`, `COASubtype`, `DebitCredit`, `JournalSource`, `JournalStatus`, `PeriodStatus`, `RecurringFreq`, `OutboxStatus`, `ReconStatus`, `MatchStatus`, `CashFlowCategory` | Rendah |
| 2 | `create_chart_of_accounts` | Tabel + index + FK self-reference | Rendah |
| 3 | `create_accounting_periods` | Tabel + unique `(tenantId, year, month)` | Rendah |
| 4 | `create_journal_tables` | `journal_entries` + `journal_lines` + index, FK | Rendah |
| 5 | `create_recurring_journal_templates` | Tabel | Rendah |
| 6 | `create_accounting_outbox` | Tabel + index `(status, scheduled_at)` | Rendah |
| 7 | `create_bank_reconciliation` | `bank_reconciliations` + `bank_reconciliation_lines` | Rendah |
| 8 | `extend_existing_for_accounting` | `expense_categories.coaId`, `financial_accounts.coaId` (nullable) | Rendah |

#### DB Trigger (di migration #4)

```sql
CREATE OR REPLACE FUNCTION check_journal_balance() RETURNS trigger AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN side = 'DEBIT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN side = 'CREDIT' THEN amount ELSE 0 END), 0)
  INTO total_debit, total_credit
  FROM journal_lines WHERE entry_id = NEW.entry_id;

  IF total_debit <> total_credit AND
     (SELECT status FROM journal_entries WHERE id = NEW.entry_id) = 'POSTED' THEN
    RAISE EXCEPTION 'Journal entry % unbalanced: DR=%, CR=%',
      NEW.entry_id, total_debit, total_credit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_balance_check
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_journal_balance();
```

Trigger DEFERRED supaya transaction bisa insert multiple lines dulu, baru di-check saat commit. **Tidak mungkin** ada jurnal POSTED tidak balance — bahkan kalau ada bug di service layer.

#### Data Migration (one-time, idempotent)

Script `prisma/seed-accounting.ts`, run setelah migration #8:

```typescript
async function seedAccountingForTenant(tenantId: string) {
  await seedDefaultChartOfAccounts(tenantId);  // idempotent
  await linkFinancialAccountsToCOA(tenantId);
  await ensureCurrentPeriodExists(tenantId);
}
```

Tidak generate jurnal historis. Akuntan input opening balance via UI sebagai jurnal `source=OPENING_BALANCE`.

#### Rollback

| Migration | Rollback |
|-----------|----------|
| 1-7 (tabel baru) | `DROP TABLE` + `DROP TYPE` — aman |
| 8 (extend) | `ALTER TABLE ... DROP COLUMN coa_id` — aman (nullable) |
| Trigger | `DROP TRIGGER` — aman |

Semua rollback test di staging dulu sebelum production.

#### Production Rollout

```
[Tahap 1: Migration only — code feature OFF]
1. Deploy code dengan flag ACCOUNTING_MODULE_ENABLED=false
2. Run prisma migrate deploy → 8 migration applied
3. Verifikasi: existing finance flow normal
4. Run seed script per tenant terkontrol

[Tahap 2: Internal testing — feature ON untuk pilot]
5. Enable flag untuk 1 tenant pilot
6. Outbox processor jalan, generate jurnal untuk transaksi baru
7. Akuntan input opening balance, validasi laporan vs spreadsheet existing
8. Run paralel 2-4 minggu

[Tahap 3: Rollout bertahap]
9. Enable flag tenant lain bertahap (per minggu 2-3 tenant)
10. Monitor outbox queue, balance integrity, performa query

[Tahap 4: Default ON]
11. Hapus feature flag
12. Outbox processor jadi mandatory
```

### 6.2. Testing Strategy

#### Unit tests (Vitest, target ≥80%)
- Domain entities: invariant (JournalEntry balance, COA tree no-cycle).
- Value objects: `Money` arithmetic accuracy (Decimal, no float drift).
- Mappers: event payload → JournalEntry untuk semua case (paid, refund, void, partial).
- Services: COA hierarchy ops, recurring journal generator, period closing logic.

#### Integration tests (real DB, target ≥70%)
- Outbox flow end-to-end: simulate `invoice.paid` → assert journal POSTED dengan amount benar.
- Idempotency: run handler 2x untuk event sama → cuma 1 journal entry.
- Period closing: tutup periode → closing journal generated, jurnal periode tsb tidak bisa diubah.
- Concurrent outbox processing: 2 worker paralel → tidak ada double-posting (test `FOR UPDATE SKIP LOCKED`).
- DB balance trigger: insert journal lines tidak balance → DB reject.

#### Critical path (target 100%)
- Trial balance balance check.
- Period closing rollover ke laba ditahan.
- Reverse journal generates correct opposite entries.
- Bank reconciliation amount matching.

#### Property-based tests (`fast-check`)
- Random sequence of journal entries → trial balance selalu balance.
- Random period closings & reopenings → audit trail tidak hilang.

#### E2E (Playwright)
1. Akuntan buat manual journal → balance auto-validate → submit → muncul di GL.
2. Pelanggan bayar invoice → tunggu outbox → jurnal otomatis muncul.
3. Akuntan tutup buku Mei → coba tambah jurnal Mei → ditolak.
4. Generate Laba Rugi & Neraca → angka konsisten dengan trial balance.

### 6.3. Observability

**Metrics**:
- `accounting.outbox.pending_count` — alert > 1000 selama > 5 menit.
- `accounting.outbox.dead_count` — alert > 0.
- `accounting.journal.unbalanced_count` — harus 0, alert critical kalau > 0.
- `accounting.outbox.processing_lag_seconds` — alert p95 > 60 detik.
- `accounting.period.stuck_in_closing` — alert > 1 jam.

**Daily health check** (cron pagi):
1. Trial balance per tenant aktif → assert DR = CR.
2. Sum outbox PENDING → expected < threshold.
3. Verifikasi: tidak ada jurnal POSTED dengan periode CLOSED.
4. Send report ke akuntan kalau ada anomali.

### 6.4. Performance

- **Volume**: ~100 jurnal/tenant/hari → setahun ~36k `journal_entries`, ~80k `journal_lines`. Tidak butuh materialized view di v1.
- **Trial balance query**: dengan index `(tenantId, status, entryDate)` + `(coaId)`, query agregat ~200k baris < 200ms (memenuhi p95 SLA project).
- **Outbox processor**: batch 100, interval 30 detik → throughput 12k events/jam (cukup 100+ tenant).
- **Decimal**: `Decimal(19,2)` + lib `decimal.js` (sudah ada di project deps).

### 6.5. Risk Register

| Risiko | Likelihood | Impact | Mitigasi |
|--------|------------|--------|----------|
| Outbox event hilang sebelum commit | Low | High | Insert outbox dalam transaction yang sama dengan source — atomic |
| Worker crash setelah generate journal sebelum mark PROCESSED | Med | Med | Idempotency check `(source, sourceRefId)` |
| Journal tidak balance di prod | Low | Critical | DB trigger DEFERRED — tidak mungkin commit |
| COA mapping salah → laporan misleading | Med | High | Unit test mapping per case, UI preview di v1.5 |
| Period closing race condition | Low | High | Lock period via `SELECT ... FOR UPDATE` saat status transition |
| Existing finance services lupa publish event | Med | High | Code review gate + integration test "ada event untuk setiap transaction type" |
| Migration di-roll back saat sudah ada jurnal | Low | Critical | Feature flag — tidak generate jurnal sampai akuntan input opening balance |

---

## 7. Roadmap Pasca-v1

Item Out of Scope v1 ini valid roadmap masa depan, **bukan dibuang permanen**. Diatur prioritas berdasarkan trigger.

| Phase | Fitur | Trigger / Kapan |
|-------|-------|-----------------|
| **v1.1** (1-2 bulan setelah v1 stabil) | Fixed asset depreciation otomatis (link ke `Asset` model existing) | Setelah recurring journal terbukti reliable |
| **v1.2** | Approval workflow untuk manual journal entry | Saat ada multiple akuntan per tenant |
| **v1.3** | Backfill historis (opsional, per tenant request) | Kalau ada tenant butuh laporan tahun lalu |
| **v2.0** | Tax reporting (PPN keluaran/masukan, PPh 21/23/Final) | Saat akuntan butuh prepare SPT |
| **v2.1** | e-Faktur / e-Bupot integration (DJP API) | Setelah tax reporting jalan |
| **v2.2** | Cost center / department accounting | Saat owner mau lihat profit per cabang/divisi |
| **v3.0** | Multi-currency | Saat ada tenant transaksi USD/SGD |
| **v3.1** | Konsolidasi multi-tenant (laporan group) | Saat ada holding company structure |
| **v3.2** | Export ke Accurate / Zahir / MYOB | Saat ada audit eksternal butuh format vendor |

### 7.1. Design Accommodation di v1 (untuk smooth upgrade)

Arsitektur v1 dirancang **tidak menutup pintu** untuk fitur roadmap:

- **Multi-currency**: amount sudah `Decimal(19,2)` — tinggal tambah field `currency` (default 'IDR') + `exchangeRate` di `JournalLine`.
- **Approval workflow**: `JournalEntry.status` enum sudah include `DRAFT` slot, `JournalSource` include `ADJUSTMENT` — tinggal tambah state `PENDING_APPROVAL`.
- **Tax reporting**: `ChartOfAccount` punya field flexible untuk extension (akan tambah `taxCategory` nullable).
- **Cost center**: tinggal tambah `JournalLine.costCenterId` nullable + table `CostCenter`.
- **Outbox pattern**: mudah extend untuk event tax reporting (tinggal tambah handler).
- **Fixed asset depreciation**: existing `Asset` model sudah punya `purchaseDate`, `usefulLife`, `currentValue` — engine depreciation tinggal di-trigger via recurring journal.

---

## 8. Checklist Self-Review

- [x] Tidak ada placeholder / TBD.
- [x] Internal consistency: schema ↔ event mapping ↔ laporan saling konsisten.
- [x] Scope: focused untuk single implementation plan (v1 only). Roadmap v2+ disebut tapi tidak detail.
- [x] Ambiguity: setiap requirement (accrual basis, opening balance manual, period closing rules) di-state eksplisit.
- [x] Migration plan: production-safe, additive, reversible.
- [x] RBAC permissions: di-list eksplisit dengan default role mapping.
- [x] Risk register: cover failure mode utama + mitigasi.

---

## 9. Open Questions / Asumsi Yang Perlu Konfirmasi

1. **[Asumsi]** Accrual basis untuk pengakuan pendapatan (Invoice created → DR AR / CR Revenue, lalu Invoice paid → DR Bank / CR AR). Alternatif cash basis (Revenue recognized saat paid) — kalau akuntan prefer cash basis, mapping disederhanakan.
2. **[Asumsi]** Tenant tunggal untuk satu set buku. Tidak ada multi-book per tenant di v1.
3. **[Asumsi]** Outbox processor jalan sebagai cron job di Next.js custom server (`server.ts`). Alternatif: dedicated worker process — ditahan untuk v1.
4. **[Asumsi]** Format `JournalEntry.entryNumber` = `JV-YYYY-MM-####` (sequential per tenant per bulan). Akuntan bisa override prefix di v2.

Konfirmasi atau koreksi atas asumsi di atas akan di-incorporate ke implementation plan.
