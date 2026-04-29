import { prisma } from "@/modules/database";
import type { Account } from "@/types";

type UnpaidPurchaseOrder = Awaited<
  ReturnType<typeof prisma.purchaseOrder.findMany>
>[number] & { transactions: { amount: number }[] };

export interface UnpaidBillsReadRepositoryPort {
  findUnpaidBillsPageData(): Promise<{
    unpaidPos: UnpaidPurchaseOrder[];
    accounts: Account[];
  }>;
}

export class UnpaidBillsReadRepository implements UnpaidBillsReadRepositoryPort {
  async findUnpaidBillsPageData() {
    const [unpaidPos, accounts] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          status: { in: ["ORDERED", "RECEIVED", "PARTIAL"] },
          paymentStatus: { not: "PAID" },
        },
        include: {
          supplier: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.financialAccount.findMany({
        where: { isActive: true },
        orderBy: { type: "asc" },
      }),
    ]);

    const invoiceNumbers = unpaidPos.map(
      (purchaseOrder) => purchaseOrder.poNumber,
    );
    const expenses = invoiceNumbers.length
      ? await prisma.expense.findMany({
          where: {
            invoiceNumber: { in: invoiceNumbers },
          },
          select: {
            amount: true,
            invoiceNumber: true,
          },
        })
      : [];

    const expensesByInvoiceNumber = new Map<string, { amount: number }[]>();
    for (const expense of expenses) {
      const key = expense.invoiceNumber ?? "";
      const current = expensesByInvoiceNumber.get(key) ?? [];
      current.push({ amount: Number(expense.amount) });
      expensesByInvoiceNumber.set(key, current);
    }

    const unpaidBills = unpaidPos.map((purchaseOrder) => ({
      ...purchaseOrder,
      transactions: expensesByInvoiceNumber.get(purchaseOrder.poNumber) ?? [],
    }));

    return { unpaidPos: unpaidBills, accounts: accounts as Account[] };
  }
}
