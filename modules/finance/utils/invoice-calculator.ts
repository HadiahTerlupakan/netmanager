export type InvoiceAmountSummary = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
};

const DEFAULT_DISCOUNT_AMOUNT = 0;
const ZERO_AMOUNT = 0;

/** Menghitung subtotal, diskon, pajak, dan total invoice tanpa mengubah format existing. */
export function calculateInvoiceAmounts(params: {
  subtotal: number;
  taxRate?: number;
  discountAmount?: number;
}): InvoiceAmountSummary {
  const discountAmount = params.discountAmount ?? DEFAULT_DISCOUNT_AMOUNT;
  const taxableAmount = params.subtotal - discountAmount;
  const taxAmount = params.taxRate
    ? Math.round(taxableAmount * params.taxRate)
    : ZERO_AMOUNT;

  return {
    subtotal: params.subtotal,
    discountAmount,
    taxAmount,
    totalAmount: taxableAmount + taxAmount,
  };
}
