export type TaxPayStatus = "BELUM_SETOR" | "SUDAH_SETOR" | "TERLAMBAT";

export interface TaxPeriodSummary {
  id: string;
  tenantId: string;
  year: number;
  month: number;
  ppnKeluaran: number;
  ppnMasukan: number;
  ppnKurangBayar: number;
  pph21Total: number;
  pph23Total: number;
  pph4Total: number;
  bhpAccrual: number;
  usoAccrual: number;
  ppnStatus: TaxPayStatus;
  pph21Status: TaxPayStatus;
  pph23Status: TaxPayStatus;
  pph4Status: TaxPayStatus;
  bhpStatus: TaxPayStatus;
  ppnPaidAt: Date | null;
  pph21PaidAt: Date | null;
  pph23PaidAt: Date | null;
  pph4PaidAt: Date | null;
  bhpPaidAt: Date | null;
  ppnPenalty: number;
  pph21Penalty: number;
  pph23Penalty: number;
  calculatedAt: Date | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
