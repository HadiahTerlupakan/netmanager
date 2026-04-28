import { ReceivablesRepository } from "../repositories/ReceivablesRepository";
import type { ReceivableEntity } from "../domain/entities/ReceivableEntity";
import type { IReceivablesRepository } from "../domain/ports/IReceivablesRepository";
import type { InvoiceStatus } from "@/types";
import type { ReceivableViewModel } from "../dto/ReceivableDTO";

const BILLING_STATUS_TO_INVOICE_STATUS: Record<string, InvoiceStatus> = {
  PARTIAL_PAID: "PARTIAL",
};

export class ReceivablesPageService {
  constructor(
    private readonly repository: IReceivablesRepository = new ReceivablesRepository(),
  ) {}

  /** Ambil data piutang yang sudah siap dikirim ke client page. */
  async getReceivables(): Promise<ReceivableViewModel[]> {
    const receivables = await this.repository.findReceivables();
    return receivables.map((receivable) => this.toViewModel(receivable));
  }

  private toViewModel(receivable: ReceivableEntity): ReceivableViewModel {
    return {
      ...receivable,
      status: this.toInvoiceStatus(receivable.status),
      totalAmount: Number(receivable.totalAmount),
      paidAmount: Number(receivable.paidAmount),
      subtotal: Number(receivable.subtotal),
      taxAmount: Number(receivable.taxAmount),
      discountAmount: Number(receivable.discountAmount),
      payment:
        receivable.payment?.map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
        })) ?? [],
    };
  }

  private toInvoiceStatus(status: string): InvoiceStatus {
    return (
      BILLING_STATUS_TO_INVOICE_STATUS[status] ?? (status as InvoiceStatus)
    );
  }
}

export const receivablesPageService = new ReceivablesPageService();
