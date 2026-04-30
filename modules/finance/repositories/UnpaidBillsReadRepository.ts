import { prisma } from "@/modules/database";
import type { Account } from "@/types";
import type { IUnpaidBillsReadRepository } from "../domain/ports/IUnpaidBillsReadRepository";
import {
  groupExpensesByInvoiceNumber,
  mapUnpaidBillsWithTransactions,
} from "./shared/unpaidBillsMapper";

export class UnpaidBillsReadRepository implements IUnpaidBillsReadRepository {
  /** Mengambil data halaman tagihan vendor yang belum lunas. */
  async findUnpaidBillsPageData() {
    const [unpaidPurchaseOrders, accounts] = await Promise.all([
      this.findUnpaidPurchaseOrders(),
      this.findActiveAccounts(),
    ]);
    const expenses = await this.findExpensesByInvoiceNumbers(
      unpaidPurchaseOrders.map((purchaseOrder) => purchaseOrder.poNumber),
    );
    const expensesByInvoiceNumber = groupExpensesByInvoiceNumber(expenses);
    const unpaidBills = mapUnpaidBillsWithTransactions(
      unpaidPurchaseOrders,
      expensesByInvoiceNumber,
    );

    return { unpaidPos: unpaidBills, accounts: accounts as Account[] };
  }

  /** Mengambil purchase order unpaid beserta supplier. */
  private findUnpaidPurchaseOrders() {
    return prisma.purchaseOrder.findMany({
      where: {
        status: { in: ["ORDERED", "RECEIVED", "PARTIAL"] },
        paymentStatus: { not: "PAID" },
      },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Mengambil akun keuangan aktif untuk dropdown pembayaran. */
  private findActiveAccounts() {
    return prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { type: "asc" },
    });
  }

  /** Mengambil expense yang terkait dengan nomor invoice PO. */
  private findExpensesByInvoiceNumbers(invoiceNumbers: string[]) {
    if (invoiceNumbers.length === 0) {
      return Promise.resolve([]);
    }

    return prisma.expense.findMany({
      where: { invoiceNumber: { in: invoiceNumbers } },
      select: { amount: true, invoiceNumber: true },
    });
  }
}
