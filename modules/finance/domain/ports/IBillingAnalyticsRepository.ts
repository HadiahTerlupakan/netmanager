/** Pembayaran seperlunya untuk agregasi analitik. */
export interface AnalyticsPayment {
  amount: bigint;
  paymentMethod: string;
}

/** Invoice beserta pembayarannya untuk agregasi analitik. */
export interface AnalyticsInvoiceWithPayments {
  status: string;
  totalAmount: bigint;
  payment: AnalyticsPayment[];
}

/** Baris ringkas invoice untuk perhitungan tren bulanan. */
export interface InvoiceAmountRow {
  createdAt: Date;
  totalAmount: bigint;
}

/** Ringkasan pembayaran per pelanggan untuk papan peringkat analitik. */
export interface TopCustomerPayment {
  id: string;
  name: string;
  totalPaid: number;
  /** Jumlah transaksi pembayaran, bukan jumlah invoice. */
  paymentCount: number;
}

/** Port pembacaan data untuk analitik billing. */
export interface IBillingAnalyticsRepository {
  getInvoicesWithPayments(
    dateStart: Date,
    dateEnd: Date,
  ): Promise<AnalyticsInvoiceWithPayments[]>;
  getPayments(dateStart: Date, dateEnd: Date): Promise<AnalyticsPayment[]>;
  getInvoiceAmountsForRange(
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<InvoiceAmountRow[]>;
  getTopCustomersByPayment(
    dateStart: Date,
    dateEnd: Date,
    limit?: number,
  ): Promise<TopCustomerPayment[]>;
}
