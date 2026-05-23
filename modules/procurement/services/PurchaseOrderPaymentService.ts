import { logActivitySafe } from "@/lib/logger";
import { eventBus } from "@/lib/event-bus";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import { PurchaseOrderRepository } from "../repositories/PurchaseOrderRepository";
import type { IPurchaseOrderRepository } from "../domain/ports/IPurchaseOrderRepository";

export interface PayPurchaseOrderInput {
  poId: string;
  amount: number;
  date: Date | string;
  notes?: string;
  createdById: string;
  paidFromAccountId?: string;
}

/**
 * Service untuk memproses pembayaran Purchase Order.
 * Sebelumnya berada di `modules/finance` dengan nama
 * FinancePurchaseOrderPaymentService — dipindah ke `procurement` agar
 * lifecycle PO (termasuk pembayaran) dimiliki oleh modul yang sama.
 *
 * Aliran finansial (debit financial account, create Expense) tetap
 * dilakukan via Prisma transaction di repository, sementara emit event
 * `PURCHASE_ORDER_PAID` membuat modul finance/tax/accounting bisa
 * react tanpa coupling langsung.
 */
export class PurchaseOrderPaymentService {
  constructor(
    private readonly poRepo: IPurchaseOrderRepository = new PurchaseOrderRepository(),
  ) {}

  async payPurchaseOrder(input: PayPurchaseOrderInput) {
    const po = await this.poRepo.findById(input.poId);

    if (!po) throw new Error("Purchase Order not found");
    if (po.paymentStatus === "PAID")
      throw new Error("Tagihan PO ini sudah lunas");

    const result = await this.poRepo.processPaymentTransaction({
      poId: input.poId,
      po,
      amount: input.amount,
      date: new Date(input.date),
      notes: input.notes,
      paidFromAccountId: input.paidFromAccountId,
    });

    logActivitySafe({
      action: "PAYMENT",
      subject: "Purchase Order",
      userId: input.createdById,
      details: {
        poId: po.id,
        poNumber: po.poNumber,
        amount: input.amount,
        status: result.newStatus,
        expenseId: result.expense.id,
      },
    });

    if (po.tenantId) {
      eventBus
        .publish(EVENT_NAMES.PURCHASE_ORDER_PAID, {
          purchaseOrderId: po.id,
          tenantId: po.tenantId,
          amount: input.amount.toString(),
          accountId: input.paidFromAccountId ?? "",
          paidAt: new Date(input.date).toISOString(),
        })
        .catch(() => {});
    }

    return result.expense;
  }
}
