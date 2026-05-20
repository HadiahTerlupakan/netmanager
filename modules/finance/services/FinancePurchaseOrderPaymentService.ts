import { logActivitySafe } from "@/lib/logger";
import { PurchaseOrderRepository } from "../repositories";
import { eventBus } from "@/lib/event-bus";
import { EVENT_NAMES } from "@/lib/event-bus/types";

type PurchaseOrderRepo = Pick<
  PurchaseOrderRepository,
  "findById" | "processPaymentTransaction"
>;

export class FinancePurchaseOrderPaymentService {
  constructor(
    private readonly purchaseOrderRepo: PurchaseOrderRepo = new PurchaseOrderRepository(),
  ) {}

  /** Process payment for a Purchase Order. */
  async payPurchaseOrder(input: {
    poId: string;
    amount: number;
    date: Date | string;
    notes?: string;
    createdById: string;
    paidFromAccountId?: string;
  }) {
    const po = await this.purchaseOrderRepo.findById(input.poId);

    if (!po) throw new Error("Purchase Order not found");
    if (po.paymentStatus === "PAID")
      throw new Error("Tagihan PO ini sudah lunas");

    const result = await this.purchaseOrderRepo.processPaymentTransaction({
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
