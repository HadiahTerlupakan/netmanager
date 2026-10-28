/**
 * Baris jurnal pelunasan invoice dari uang yang benar-benar diterima.
 *
 * Dulu satu baris Debit Bank / Kredit Piutang sebesar total invoice: potongan
 * kupon ikut dicatat sebagai uang masuk (padahal kupon sudah mengkredit
 * Piutang lewat jurnal kupon), semua penerimaan gateway jatuh ke "Bank" walau
 * dananya masih di gateway, dan biaya gateway tidak dibukukan.
 */
export type ReceivedPayment = {
  amount: bigint;
  gatewayFee: bigint | null;
  accountId: string | null;
  isGateway: boolean;
};

export type ReceiptCoa = {
  piutang: string;
  defaultBank: string;
  gatewayBalance: string;
  gatewayFee: string;
  /** COA rekening Kas & Bank yang dipilih pelanggan (transfer manual). */
  accountCoa: Map<string, string>;
};

export type JournalLineDraft = {
  coaId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
};

function debitTarget(payment: ReceivedPayment, coa: ReceiptCoa) {
  if (payment.isGateway) return coa.gatewayBalance;
  if (payment.accountId) {
    return coa.accountCoa.get(payment.accountId) ?? coa.defaultBank;
  }
  return coa.defaultBank;
}

export function buildInvoicePaidLines(
  payments: ReceivedPayment[],
  coa: ReceiptCoa,
): JournalLineDraft[] {
  const debits = new Map<string, bigint>();
  const add = (coaId: string, amount: bigint) => {
    if (amount > 0n) debits.set(coaId, (debits.get(coaId) ?? 0n) + amount);
  };

  let received = 0n;
  for (const payment of payments) {
    if (payment.amount <= 0n) continue;
    received += payment.amount;
    // Gateway memotong biayanya sebelum dana mengendap di saldo gateway.
    const fee =
      payment.isGateway && payment.gatewayFee && payment.gatewayFee > 0n
        ? payment.gatewayFee
        : 0n;
    add(debitTarget(payment, coa), payment.amount - fee);
    add(coa.gatewayFee, fee);
  }
  if (received === 0n) return [];

  return [
    ...[...debits].map(([coaId, amount]) => ({
      coaId,
      side: "DEBIT" as const,
      amount: amount.toString(),
    })),
    { coaId: coa.piutang, side: "CREDIT", amount: received.toString() },
  ];
}
