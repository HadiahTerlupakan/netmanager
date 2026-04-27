import { AutomaticBillingService } from "./AutomaticBillingService";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { PelangganRepository } from "@/modules/pelanggan";
import { sendCustomerPushNotification } from "@/modules/notification";
import { createRouteServiceError } from "./RouteServiceError";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

type PendingManualPaymentsInput = {
  startDate?: string | null;
  endDate?: string | null;
  siteId?: string | null;
  status?: string | null;
  isSiteOnly?: boolean;
};

const MAX_PENDING_MANUAL_PAYMENTS = 500;
const EMPTY_SCOPE: string[] = [];
const PAYMENT_NOT_FOUND_MESSAGE = "Payment not found or already processed";
const INVALID_ACTION_MESSAGE = "Invalid action";

function mapGatewayStatusFilter(status?: string | null) {
  if (status === "PENDING") return "PENDING";
  if (status === "APPROVED") return { in: ["SUCCESS", "PAID"] };
  if (status === "REJECTED") return { in: ["FAILED", "CANCELLED"] };
  return undefined;
}

function serializePayment(
  payment: Record<string, unknown>,
  customerName: string,
) {
  const amount = (payment.amount as bigint).toString();
  const invoice = payment.invoice as Record<string, unknown> | null | undefined;
  return {
    ...payment,
    amount,
    invoice: invoice
      ? { ...invoice, totalAmount: (invoice.totalAmount as bigint).toString() }
      : null,
    customerName,
  };
}

export class ManualPaymentAdminRouteService {
  constructor(
    private readonly paymentRepository = new PaymentRepository(),
    private readonly invoiceRepository = new InvoiceRepository(),
    private readonly pelangganRepository = new PelangganRepository(),
  ) {}

  /** Get pending manual payments with optional date and site filters. */
  async getPendingManualPayments(input: PendingManualPaymentsInput) {
    const where: Record<string, unknown> = { receiptUrl: { not: null } };
    if (input.startDate && input.endDate) {
      const start = new Date(input.startDate);
      start.setTime(toStartOfDay(start).getTime());
      const end = new Date(input.endDate);
      end.setTime(toEndOfDay(end).getTime());
      where.createdAt = { gte: start, lte: end };
    }
    const gatewayStatus = mapGatewayStatusFilter(input.status);
    if (gatewayStatus) where.gatewayStatus = gatewayStatus;
    const pelangganIds = await this.getScopedPelangganIds(
      input.siteId,
      Boolean(input.isSiteOnly),
    );
    if (pelangganIds) where.pelangganId = { in: pelangganIds };

    const payments = await this.paymentRepository.findMany(where, {
      id: true,
      pelangganId: true,
      invoiceId: true,
      amount: true,
      gatewayStatus: true,
      paymentDate: true,
      paymentMethod: true,
      notes: true,
      receiptUrl: true,
      createdAt: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          pelangganId: true,
          totalAmount: true,
        },
      },
    });
    const sortedPayments = payments
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(0, MAX_PENDING_MANUAL_PAYMENTS);
    const customerMap = await this.getCustomerNameMap(
      sortedPayments.map((payment) => payment.pelangganId),
    );
    return sortedPayments.map((payment) =>
      serializePayment(
        payment as Record<string, unknown>,
        customerMap[payment.pelangganId] || "Pelanggan Tidak Diketahui",
      ),
    );
  }

  /** Verify a manual payment and trigger related invoice side effects. */
  async verifyManualPayment(input: {
    paymentId: string;
    action: string;
    notes?: string | null;
  }) {
    const payment = await this.paymentRepository.findByIdWithInvoice(
      input.paymentId,
    );
    if (!payment || payment.gatewayStatus !== "PENDING") {
      throw createRouteServiceError(PAYMENT_NOT_FOUND_MESSAGE, 404);
    }
    if (input.action === "REJECT")
      return this.rejectPayment(payment, input.notes);
    if (input.action === "APPROVE")
      return this.approvePayment(payment, input.notes);
    throw createRouteServiceError(INVALID_ACTION_MESSAGE, 400);
  }

  /** Get investor payout list with pagination. */
  async getInvestorPayouts(input: {
    investorId: string;
    page: number;
    limit: number;
  }) {
    const skip = (input.page - 1) * input.limit;
    const [payouts, total] = await Promise.all([
      this.paymentRepository.findManyInvestorPayouts({
        investorId: input.investorId,
        skip,
        take: input.limit,
      }),
      this.paymentRepository.countInvestorPayouts(input.investorId),
    ]);
    return { payouts, total };
  }

  /** Create a new investor payout. */
  async createInvestorPayout(input: {
    investorId: string;
    amount: number;
    date?: Date;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    reference?: string;
    notes?: string;
    status?: string;
  }) {
    const investor = await this.paymentRepository.findInvestorById(
      input.investorId,
    );
    if (!investor) return null;
    return this.paymentRepository.createInvestorPayout({
      investorId: input.investorId,
      amount: BigInt(input.amount),
      date: input.date || new Date(),
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      reference: input.reference,
      notes: input.notes,
      status: input.status || "COMPLETED",
    });
  }

  /** Get investor detail with recent payouts and project relations. */
  async getInvestorDetail(investorId: string) {
    const investor =
      await this.paymentRepository.findInvestorDetail(investorId);
    if (!investor) return null;
    const { passwordHash: _passwordHash, ...safeInvestor } = investor;
    return safeInvestor;
  }

  /** Reject a pending manual payment. */
  private async rejectPayment(
    payment: Awaited<ReturnType<PaymentRepository["findByIdWithInvoice"]>>,
    notes?: string | null,
  ) {
    await this.paymentRepository.updatePaymentById(payment!.id, {
      gatewayStatus: "FAILED",
      notes: notes || payment!.notes || null,
    });
    if (payment!.invoice?.pelangganId) {
      await sendCustomerPushNotification(
        payment!.invoice.pelangganId,
        "Pembayaran Ditolak",
        "Pembayaran Anda ditolak. Mohon periksa kembali bukti transfer Anda.",
        {
          paymentId: payment!.id,
          invoiceId: payment!.invoiceId,
          action: "REJECT",
        },
      );
    }
    return { success: true, message: "Payment rejected" };
  }

  /** Approve a pending manual payment. */
  private async approvePayment(
    payment: Awaited<ReturnType<PaymentRepository["findByIdWithInvoice"]>>,
    notes?: string | null,
  ) {
    await this.paymentRepository.updatePaymentById(payment!.id, {
      gatewayStatus: "PAID",
      paymentDate: new Date(),
      notes: notes || payment!.notes || null,
    });
    if (payment!.invoiceId) {
      await this.syncInvoiceAfterPaymentApproval(
        payment!.invoiceId,
        payment!.id,
      );
      if (payment!.invoice?.pelangganId) {
        await sendCustomerPushNotification(
          payment!.invoice.pelangganId,
          "Pembayaran Berhasil!",
          "Tagihan Anda telah dilunasi.",
          {
            paymentId: payment!.id,
            invoiceId: payment!.invoiceId,
            action: "APPROVE",
          },
        );
      }
    }
    return { success: true, message: "Payment approved" };
  }

  /** Synchronize invoice payment totals after approval. */
  private async syncInvoiceAfterPaymentApproval(
    invoiceId: string,
    paymentId: string,
  ) {
    const invoice = await this.invoiceRepository.findWithPayment(invoiceId);
    if (!invoice) return;
    const totalPaid = (invoice.payment || []).reduce((sum, payment) => {
      if (payment.id === paymentId) return sum + payment.amount;
      if (!payment.gatewayStatus || payment.gatewayStatus === "PAID")
        return sum + payment.amount;
      return sum;
    }, 0n);
    const invoiceStatus = this.resolveInvoiceStatus(
      totalPaid,
      invoice.totalAmount,
      invoice.status,
    );
    await this.invoiceRepository.updatePaymentStatus(invoice.id, {
      paidAmount: totalPaid,
      status: invoiceStatus as never,
      ...(invoiceStatus === "PAID" ? { paidAt: new Date() } : {}),
    });
    if (invoiceStatus === "PAID") {
      await AutomaticBillingService.handleInvoicePaid(invoice.id);
    }
  }

  /** Resolve invoice status based on accumulated paid amount. */
  private resolveInvoiceStatus(
    totalPaid: bigint,
    totalAmount: bigint,
    currentStatus: string,
  ) {
    if (totalPaid >= totalAmount) return "PAID";
    if (totalPaid > 0n) return "PARTIAL_PAID";
    return currentStatus;
  }

  /** Resolve pelanggan IDs for requested site scope. */
  private async getScopedPelangganIds(
    siteId?: string | null,
    isSiteOnly?: boolean,
  ) {
    if (isSiteOnly && !siteId) return EMPTY_SCOPE;
    if (!siteId) return null;
    const pelanggans = await this.pelangganRepository.findAll({ siteId });
    return pelanggans.map((pelanggan) => pelanggan.id);
  }

  /** Build customer name lookup map for listed payments. */
  private async getCustomerNameMap(pelangganIds: string[]) {
    if (pelangganIds.length === 0) return {} as Record<string, string>;
    const uniqueIds = Array.from(new Set(pelangganIds));
    const customers = await Promise.all(
      uniqueIds.map((id) => this.pelangganRepository.findById(id)),
    );
    return customers.reduce(
      (map, customer) => {
        if (customer) map[customer.id] = customer.nama;
        return map;
      },
      {} as Record<string, string>,
    );
  }
}
