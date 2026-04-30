/** Mengelompokkan expense per invoice number untuk halaman tagihan belum lunas. */
export function groupExpensesByInvoiceNumber(
  expenses: Array<{ amount: number | bigint; invoiceNumber: string | null }>,
) {
  const expensesByInvoiceNumber = new Map<string, { amount: number }[]>();

  for (const expense of expenses) {
    const key = expense.invoiceNumber ?? "";
    const current = expensesByInvoiceNumber.get(key) ?? [];
    current.push({ amount: Number(expense.amount) });
    expensesByInvoiceNumber.set(key, current);
  }

  return expensesByInvoiceNumber;
}

/** Menyatukan PO unpaid dengan transaksi expense terkait. */
export function mapUnpaidBillsWithTransactions<T extends { poNumber: string }>(
  purchaseOrders: T[],
  expensesByInvoiceNumber: Map<string, { amount: number }[]>,
) {
  return purchaseOrders.map((purchaseOrder) => ({
    ...purchaseOrder,
    transactions: expensesByInvoiceNumber.get(purchaseOrder.poNumber) ?? [],
  }));
}
