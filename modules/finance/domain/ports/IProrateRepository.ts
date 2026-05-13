/**
 * Repository port untuk InvoiceProrateService.
 * Membungkus seluruh akses persistence (main DB + billing DB) supaya service
 * tidak bergantung pada Prisma client langsung — sesuai Clean Architecture
 * dependency rule (service depend on abstraction).
 */

export interface PelangganProrateContext {
  id: string;
  jatuhTempo: Date;
  tanggalAktif: Date;
  hargaPaketId: string;
  tenantId: string | null;
}

export interface PackageInfo {
  id: string;
  harga: number;
}

export interface SchedulePackageChangeInput {
  pelangganId: string;
  oldHargaPaketId: string;
  newHargaPaketId: string;
  applyAt: Date;
}

export interface CreateProrateInvoiceInput {
  pelangganId: string;
  amount: bigint;
  tenantId: string | null;
  description: string;
  dueAt: Date;
}

export interface CreateRefundPaymentInput {
  pelangganId: string;
  amount: bigint;
  tenantId: string | null;
}

export interface RecordProrateLogInput {
  pelangganId: string;
  oldPackageId: string;
  newPackageId: string;
  prorateOption: string;
  downgradeAdjustment: string;
  upgradeApplyTime: string;
  amount: bigint;
  sisaHari: number;
  totalHari: number;
  createdBy: string | null;
  tenantId: string | null;
}

export interface IProrateRepository {
  /** Ambil context pelanggan minimal yang dibutuhkan untuk perhitungan prorate. */
  findPelangganProrateContext(
    pelangganId: string,
  ): Promise<PelangganProrateContext | null>;

  /** Ambil pasangan paket lama + baru paralel; null jika salah satu hilang. */
  findPackagePair(
    oldHargaPaketId: string,
    newHargaPaketId: string,
  ): Promise<{ old: PackageInfo; new: PackageInfo } | null>;

  /**
   * Update pelanggan untuk perubahan paket NEXT_CYCLE: revert hargaPaketId,
   * set pendingPackageId + pendingPackageApplyAt.
   */
  schedulePackageChange(input: SchedulePackageChangeInput): Promise<void>;

  /** Increment saldo kredit pelanggan dengan amount tertentu. */
  incrementSaldoKredit(pelangganId: string, credit: bigint): Promise<void>;

  /** Buat invoice prorate (status SENT). Return invoice id. */
  createProrateInvoice(input: CreateProrateInvoiceInput): Promise<string>;

  /** Buat payment record refund (amount negatif, status PENDING). Return id. */
  createRefundPaymentRecord(input: CreateRefundPaymentInput): Promise<string>;

  /** Catat audit log ProratePaymentLog. */
  recordProrateLog(input: RecordProrateLogInput): Promise<void>;
}
