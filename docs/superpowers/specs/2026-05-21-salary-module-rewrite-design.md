# Salary Module Rewrite — Standar Payroll Indonesia

**Date:** 2026-05-21  
**Status:** Approved  
**Approach:** Big Bang Rewrite (Approach B)  
**Scope:** Rewrite modul salary dari nol dengan standar payroll Indonesia lengkap

---

## 1. Context & Problem

Modul salary saat ini memiliki dua masalah utama:

1. **Business logic tidak lengkap** — banyak standar payroll Indonesia yang belum ter-cover (BPJS employer, THR, PPh 21 annual, gross-up, UMR validation, overtime cap, rapel, period locking)
2. **Arsitektur internal berantakan** — god service (21 service files), duplikasi logic (audit), DI tidak konsisten (factory hardcode singleton), public API terlalu lebar

### Target Users
- Perusahaan besar dengan berbagai tipe karyawan
- Multi-tenant system

### Employee Types Supported
- PKWTT (karyawan tetap)
- PKWT (kontrak)
- DAILY (harian lepas)
- FREELANCE (project-based)

---

## 2. High-Level Architecture

Modul salary baru di-decompose menjadi 7 sub-module internal:

```
modules/salary/
├── core/           # Domain model, value objects, enums, shared interfaces
├── calculation/    # Payroll calculation engine (pipeline pattern)
├── tax/            # PPh 21 engine (net, gross-up, nett, annual method)
├── benefits/       # BPJS (full), THR, rapel/back-pay, salary advance
├── payment/        # Pay schedule, period management, locking, payment tracking
├── workflow/       # Approval flow, compliance engine, audit trail
├── reporting/      # Slip gaji, export, bank file, accounting integration
└── index.ts        # Public facade (PayrollService) + DTOs only
```

### Prinsip Arsitektur
- Setiap sub-module punya `index.ts` sendiri sebagai internal API
- Public API hanya expose `PayrollService` facade + DTOs
- Sub-module berkomunikasi via interface, bukan direct import
- Calculation engine bersifat pure function (stateless, no side effects)
- State management (CRUD, workflow) terpisah dari kalkulasi
- Plugin pattern untuk extensibility (calculator pipeline)
- Configurable tanpa code change (komponen, formula, rules, tax tables)

---

## 3. Core Domain Model

### PayrollRun (Aggregate Root)

```typescript
PayrollRun {
  id, tenantId
  periodStart: Date
  periodEnd: Date
  status: DRAFT | CALCULATING | CALCULATED | AUDITED | APPROVED | PAID | CLOSED
  type: REGULAR | THR | BONUS | RAPEL | ADVANCE
  scheduleId: string              // link ke PaySchedule
  lockedAt?: Date
  lockedBy?: string
  entries: PayrollEntry[]
}
```

### PayrollEntry (Per Karyawan Per Run)

```typescript
PayrollEntry {
  id, payrollRunId, userId
  employeeType: PKWTT | PKWT | DAILY | FREELANCE
  taxMethod: NET | GROSS_UP | NETT
  basicSalary, effectiveSalary
  totalEarnings, totalDeductions, totalTax, netSalary
  employerCost: number            // BPJS employer, dll
  status: PENDING | CALCULATED | ERROR | APPROVED | PAID
  lines: PayrollLine[]
  auditLogs: PayrollAuditLog[]
}
```

### PayrollLine (Detail Baris)

```typescript
PayrollLine {
  id, entryId
  category: EARNING | DEDUCTION | TAX | EMPLOYER_COST
  componentId, componentName, componentCode
  quantity, rate, amount
  formula: string                 // bagaimana dihitung (audit trail)
  metadata?: Record<string, unknown>
}
```

### PayrollComponent (Template Komponen)

```typescript
PayrollComponent {
  id, tenantId
  name, code: string
  category: EARNING | DEDUCTION | TAX | EMPLOYER_COST
  calculationType: FIXED | PERCENTAGE | FORMULA | PER_HOUR | PER_DAY | PER_UNIT
  taxable: boolean
  applicableTo: EmployeeType[]
  isStatutory: boolean            // BPJS, PPh — tidak bisa dihapus
  formula?: string                // untuk tipe FORMULA
  sortOrder: number
  isActive: boolean
}
```

### EmployeePayrollProfile

```typescript
EmployeePayrollProfile {
  userId, tenantId
  employeeType: PKWTT | PKWT | DAILY | FREELANCE
  taxMethod: NET | GROSS_UP | NETT
  payScheduleId: string
  basicSalary: number
  payPeriodDay: number
  ptkpStatus: string              // TK_0, K_1, K_2, K_3, dll
  npwp?: string
  bpjsConfig: BpjsEnrollment
  regionCode: string              // untuk UMR lookup
  contractStart: Date
  contractEnd?: Date
  overtimeEligible: boolean
  thrEligible: boolean
  components: EmployeeComponent[] // komponen yang di-assign
}
```

### Status Flow

```
PayrollRun:   DRAFT → CALCULATING → CALCULATED → [workflow] → APPROVED → PAID → CLOSED
PayrollEntry: PENDING → CALCULATED → ERROR → (fix) → CALCULATED → APPROVED → PAID
```

- CLOSED = period locked, koreksi → buat PayrollRun type RAPEL
- REVISION_REQUESTED kembali ke CALCULATED
- REJECTED = dead end, buat run baru

---

## 4. Calculation Engine

### Pipeline Pattern (Extensible)

```typescript
interface IPayrollCalculator {
  name: string
  order: number
  applicableTo?: EmployeeType[]
  calculate(ctx: CalculationContext): CalculationResult
}

interface CalculationContext {
  employee: EmployeePayrollProfile
  period: { start: Date, end: Date }
  attendance: AttendanceSummary
  overtime: OvertimeSummary
  components: EmployeeComponent[]
  previousLines: PayrollLine[]
  config: TenantPayrollConfig
}

interface CalculationResult {
  lines: PayrollLine[]
  metadata?: Record<string, unknown>
}
```

### Default Calculator Pipeline (ordered)

1. `BasicSalaryCalculator` — gaji pokok (full atau prorated)
2. `ProrataCalculator` — proration untuk join/resign mid-period
3. `AttendanceCalculator` — potongan absen, telat
4. `OvertimeCalculator` — lembur dengan configurable tiers & rates
5. `ComponentCalculator` — loop semua komponen yang di-assign
6. `BpjsCalculator` — BPJS employee + employer share
7. `TaxCalculator` — PPh 21 (TER/progressive, net/gross-up/nett)
8. `LoanDeductionCalculator` — cicilan pinjaman & kasbon
9. `NetSalaryCalculator` — final calculation

### Extensibility

- **Tambah komponen baru** → buat PayrollComponent di DB, ComponentCalculator otomatis proses
- **Tambah calculator baru** → implement IPayrollCalculator, register di pipeline
- **Ubah aturan** → update config data, bukan code
- **Beda aturan per tenant** → TenantPayrollConfig per tenant

### Formula Engine

```typescript
// Variables tersedia:
// basicSalary, effectiveSalary, workDays, effectiveDays,
// overtimeHours, hourlyRate, dailyRate, attendance.*,
// totalEarnings, totalDeductions

// Contoh formula:
"basicSalary * 0.1"                    // 10% dari gaji pokok
"effectiveDays * 25000"                // Rp25rb per hari kerja
"IF(attendance.late > 3, 50000, 0)"    // Denda telat > 3x
```

Formula di-parse dengan sandboxed expression evaluator (bukan eval).

### Overtime Rules (Configurable)

```typescript
OvertimeConfig {
  maxHoursPerDay: number
  maxHoursPerWeek: number
  rateBase: "1/173" | "custom"
  customRateBase?: number
  tiers: OvertimeTier[]
}

OvertimeTier {
  dayType: WORKDAY | HOLIDAY | NATIONAL_HOLIDAY
  fromHour: number
  toHour: number
  multiplier: number              // 1.5x, 2x, 3x, 4x, atau custom
}
```

Default mengikuti PP 35/2021, tapi fully overridable per tenant.

### Proration Logic

- PKWTT/PKWT: `(basicSalary / totalWorkDays) × actualWorkDays`
- DAILY: tidak ada proration — dibayar per hari kerja aktual
- FREELANCE: tidak ada proration — dibayar per deliverable

---

## 5. Tax Engine (PPh 21)

### Tax Methods

| Method | Deskripsi |
|--------|-----------|
| NET | Karyawan tanggung sendiri, pajak dipotong dari gaji |
| GROSS_UP | Perusahaan tanggung penuh, tunjangan pajak ditambahkan |
| NETT | Perusahaan tanggung, tidak masuk penghasilan karyawan |

### Calculation Approach

**Bulanan (Jan-Nov):** TER (Tarif Efektif Rata-rata) per PP 58/2023
```
PPh 21 = Penghasilan Bruto × Tarif TER (berdasarkan PTKP + income bracket)
```

**Desember / Resign (Annual Correction):**
```
1. Hitung total penghasilan bruto setahun
2. Kurangi biaya jabatan (5%, max 6jt/tahun)
3. Kurangi iuran pensiun/JHT karyawan
4. Kurangi PTKP
5. Hitung PKP → terapkan tarif progresif Pasal 17
6. PPh 21 bulan terakhir = terutang setahun - sudah dipotong (Jan-Nov)
```

### Tarif Progresif Pasal 17

| PKP | Tarif |
|-----|-------|
| 0 - 60jt | 5% |
| 60jt - 250jt | 15% |
| 250jt - 500jt | 25% |
| 500jt - 5M | 30% |
| > 5M | 35% |

### Gross-Up Iterative

```
1. Hitung bruto tanpa tunjangan pajak
2. Hitung PPh 21 terutang
3. Tambahkan tunjangan pajak = PPh 21
4. Hitung ulang PPh 21 dengan tunjangan sebagai penghasilan
5. Iterasi sampai konvergen (2-3 iterasi)
```

### Special Cases

- Tanpa NPWP: +20% surcharge
- Resign mid-year: PPh 21 final
- THR/Bonus: digabung ke bulan tersebut untuk TER
- PKWT/Freelance: PPh 21 final atau non-final tergantung kontrak
- Karyawan baru mid-year: annualisasi penghasilan

### Configurable Tax Tables

```typescript
TenantTaxConfig {
  defaultMethod: NET | GROSS_UP | NETT
  terYear: number                 // versi TER yang dipakai
  npwpSurcharge: number           // 20%
  annualCorrectionMonth: number   // default 12
  biayaJabatanRate: number        // 5%
  biayaJabatanMax: number         // 500000
  ptkpTable: PtkpEntry[]          // configurable data
  terTable: TerEntry[]            // configurable data
  progressiveTable: ProgressiveEntry[]
}
```

Semua tabel pajak disimpan sebagai configurable data — update aturan pemerintah tanpa deploy code.

---

## 6. Benefits Engine

### BPJS Lengkap

```typescript
BpjsConfig {
  kesehatan: { employeeRate: 0.01, employerRate: 0.04, maxBase: 12000000 }
  jht:       { employeeRate: 0.02, employerRate: 0.037, maxBase: null }
  jp:        { employeeRate: 0.01, employerRate: 0.02, maxBase: 10042000, maxAge: 57 }
  jkk:       { employerRate: 0.0024-0.0174, riskCategory: 1-5 }
  jkm:       { employerRate: 0.003 }
}
```

- Employee share → PayrollLine category: DEDUCTION
- Employer share → PayrollLine category: EMPLOYER_COST
- Eligibility configurable per employee type

### THR (Tunjangan Hari Raya)

```typescript
ThrConfig {
  eligibleAfterMonths: 1
  fullEntitlementMonths: 12
  prorata: boolean
  components: string[]            // komponen yang masuk hitungan
  paymentDeadline: 7              // H-7 sebelum hari raya
}

// Kalkulasi:
// ≥ 12 bulan: 1 × (basicSalary + tunjangan tetap)
// < 12 bulan: (masaKerja / 12) × (basicSalary + tunjangan tetap)
// < 1 bulan: tidak eligible
```

THR sebagai PayrollRun terpisah (type: THR).

### Rapel / Back-Pay

```typescript
RapelCalculation {
  reason: SALARY_INCREASE | CORRECTION | RETROACTIVE_COMPONENT
  affectedPeriods: Period[]
  originalAmount, correctedAmount, difference, taxAdjustment
}
```

Rapel sebagai PayrollRun terpisah (type: RAPEL). System hitung ulang periode terdampak, bandingkan, dan bayar selisih.

### Salary Advance / Kasbon

```typescript
SalaryAdvancePolicy {
  maxPercentOfSalary: number      // max 30%
  maxActiveAdvances: number
  minDaysBetweenRequests: number
  approvalRequired: boolean
  deductionMethod: FULL_NEXT | INSTALLMENT
  maxInstallments: number
}
```

Status flow: PENDING → APPROVED → DISBURSED → DEDUCTED

---

## 7. Payment & Period Management

### Pay Schedule System

```typescript
PaySchedule {
  id, tenantId
  name: string
  frequency: MONTHLY | BI_WEEKLY | WEEKLY | DAILY | ON_DEMAND
  cutOffDay?: number
  cutOffDayOfWeek?: number
  payDay: number
  payDayOffset?: number
  gracePeriodDays: number
  isDefault: boolean
}
```

Setiap karyawan di-assign ke PaySchedule sesuai perjanjian kerja.

### Period Management

```typescript
PayrollPeriod {
  id, tenantId, scheduleId
  periodStart, periodEnd, payDate
  status: OPEN | PROCESSING | CLOSED | LOCKED
  lockedAt?, lockedBy?, unlockReason?
}
```

### Period Locking

```typescript
PeriodLockingPolicy {
  autoLockAfterPaid: boolean
  autoLockDelayDays: number
  requireApprovalToUnlock: boolean
  maxUnlockCount: number
}
```

LOCKED = immutable. Koreksi → PayrollRun type RAPEL.

### Payment Tracking

```typescript
PaymentBatch {
  id, tenantId, payrollRunId
  method: BANK_TRANSFER | CASH | E_WALLET
  totalAmount, totalEntries
  status: PENDING | PROCESSING | COMPLETED | PARTIAL_FAILED
  items: PaymentItem[]
}

PaymentItem {
  id, batchId, payrollEntryId, userId
  amount, bankAccount, status, failureReason?, transferRef?
}
```

---

## 8. Workflow & Compliance

### Configurable Approval Workflow

```typescript
PayrollWorkflowConfig {
  tenantId: string
  steps: WorkflowStep[]
  parallelApproval: boolean
  autoApproveBelow?: number
}

WorkflowStep {
  order: number
  name: string                    // "HR Review", "Finance Approval"
  approverType: ROLE | USER | DEPARTMENT_HEAD
  approverValue: string
  requiredCount: number
  timeoutDays: number
  canReject: boolean
  canRequestRevision: boolean
}
```

### Compliance Engine

Built-in rules (configurable severity):

| Rule | Default Severity |
|------|-----------------|
| UMR_CHECK | ERROR |
| OVERTIME_DAILY_CAP | WARNING |
| OVERTIME_WEEKLY_CAP | WARNING |
| BPJS_ENROLLMENT | WARNING |
| NPWP_MISSING | WARNING |
| CONTRACT_EXPIRY | WARNING |
| NEGATIVE_NET_SALARY | ERROR |
| THR_DEADLINE | WARNING |
| PERIOD_OVERLAP | ERROR |

- ERROR = block payroll, tidak bisa approve
- WARNING = flag, bisa lanjut tapi tercatat

### UMR Management

```typescript
RegionalMinimumWage {
  id, tenantId, regionCode, regionName
  year, monthlyAmount, dailyAmount?, effectiveDate, source?
}
```

### Overtime Cap Enforcement

```typescript
OvertimeCapPolicy {
  dailyMaxHours, weeklyMaxHours, monthlyMaxHours?
  enforcement: HARD_BLOCK | SOFT_WARNING | LOG_ONLY
  exceptionRoles?: string[]
}
```

### Full Audit Trail

```typescript
PayrollAuditLog {
  id, tenantId
  entityType: PAYROLL_RUN | PAYROLL_ENTRY | PAYROLL_LINE | CONFIG
  entityId, action, performedBy, timestamp
  changes: { field, oldValue, newValue }[]
  reason?: string
}
```

---

## 9. Reporting & Integration

### Slip Gaji

```typescript
PayslipTemplate {
  id, tenantId, name
  format: PDF | HTML | THERMAL
  layout: PayslipSection[]
  showEmployerCost, showYtdTotals: boolean
  language: "id" | "en"
}
```

### Export Reports

| Report | Format |
|--------|--------|
| Payroll Summary | XLSX, PDF |
| Payroll Detail | XLSX, CSV |
| Bank Transfer File | Per bank format (BCA, Mandiri, BRI, BNI) |
| BPJS Report (SIPP) | XLSX |
| SPT Masa PPh 21 (1721) | XLSX, PDF |
| SPT Tahunan (1721-A1) | PDF |
| THR Report | XLSX |
| Overtime Report | XLSX |
| Cost Center Report | XLSX |
| Salary Journal | JSON (untuk posting ke GL) |

### Accounting Integration (Event-Driven)

Saat PayrollRun → PAID, emit `PayrollPaidEvent` dengan journal lines:
- Debit: Beban Gaji, Beban BPJS Employer, Beban PPh 21 (gross-up)
- Credit: Hutang Gaji, Hutang BPJS, Hutang PPh 21, Hutang Pinjaman

Mapping COA configurable per tenant via `PayrollJournalConfig`.

### Notification Events

- PAYROLL_CALCULATED → notify HR
- APPROVAL_NEEDED → notify approver
- PAYROLL_PAID → notify karyawan
- SLIP_AVAILABLE → notify karyawan
- COMPLIANCE_WARNING → notify HR
- THR_REMINDER → notify HR

### Mobile API

```
GET  /api/mobile/salary              — list slip gaji
GET  /api/mobile/salary/:id          — detail slip
GET  /api/mobile/salary/:id/download — download PDF
GET  /api/mobile/salary/ytd          — year-to-date
POST /api/mobile/salary/advance      — request kasbon
GET  /api/mobile/salary/advance      — list kasbon aktif
```

---

## 10. Migration Strategy

Karena ini rewrite (Approach B):

1. **Buat modul baru** di `modules/salary/` (replace existing)
2. **Prisma migration** — tambah tabel baru, rename/drop tabel lama
3. **Data migration script** — konversi data salary lama ke format baru
4. **API endpoints** — buat endpoint baru, deprecate yang lama
5. **Frontend** — rewrite halaman admin salary
6. **Testing** — comprehensive unit + integration tests per sub-module

### Backward Compatibility

- Data salary historis (yang sudah PAID) akan di-migrate ke format baru (read-only)
- Salary yang masih DRAFT/CALCULATED di-discard (hitung ulang dengan engine baru)
- API contract berubah — frontend harus di-update bersamaan

---

## 11. Implementation Order (Sub-Projects)

| Phase | Sub-module | Dependency |
|-------|-----------|------------|
| 1 | Core (domain model, interfaces, enums) | — |
| 2 | Calculation Engine (pipeline, calculators) | Core |
| 3 | Tax Engine (PPh 21) | Core, Calculation |
| 4 | Benefits (BPJS, THR, rapel, advance) | Core, Calculation, Tax |
| 5 | Payment & Period (schedule, locking, tracking) | Core |
| 6 | Workflow & Compliance (approval, rules, audit) | Core, Payment |
| 7 | Reporting & Integration (slip, export, events) | All above |
| 8 | API Layer (admin + mobile endpoints) | All above |
| 9 | Frontend (admin pages) | API Layer |
| 10 | Migration (data + schema) | All above |

Setiap phase bisa di-spec dan implement secara independen setelah dependency-nya selesai.

---

## 12. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Pipeline pattern untuk calculation | Extensible tanpa ubah core engine |
| Formula engine (sandboxed) | Custom komponen tanpa code change |
| PayrollRun sebagai aggregate | Satu unit kerja yang bisa di-lock, approve, audit |
| Separate run types (REGULAR, THR, RAPEL) | Tracking jelas, tax treatment benar |
| Configurable tax tables | Update aturan pemerintah tanpa deploy |
| Event-driven accounting integration | Loose coupling antar modul |
| Full audit trail | Compliance ketenagakerjaan dan pajak |
| Compliance engine dengan severity levels | Flexible enforcement per tenant |

---

*Spec approved: 2026-05-21*
