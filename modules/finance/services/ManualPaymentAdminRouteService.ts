import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { PelangganBillingBridgeService } from "@/modules/pelanggan";
import { createRouteServiceError } from "./RouteServiceError";
import {
  approveManualPayment,
  buildPendingManualPaymentsWhere,
  getCustomerNameMap,
  getScopedPelangganIds,
  limitPendingManualPayments,
  rejectManualPayment,
  serializeManualPayment,
  type PendingManualPaymentsInput,
} from "./manual-payment-admin.helpers";

const PAYMENT_NOT_FOUND_MESSAGE = "Payment not found or already processed";
const INVALID_ACTION_MESSAGE = "Invalid action";

export class ManualPaymentAdminRouteService {
  constructor(
    private readonly paymentRepository = new PaymentRepository(),
    private readonly invoiceRepository = new InvoiceRepository(),
    private readonly pelangganRepository = new PelangganBillingBridgeService(),
  ) {}

  /** Get pending manual payments with optional date and site filters. */
  async getPendingManualPayments(input: PendingManualPaymentsInput) {
    const where = buildPendingManualPaymentsWhere(input);
    const pelangganIds = await getScopedPelangganIds(
      this.pelangganRepository,
      input.siteId,
      Boolean(input.isSiteOnly),
    );

    if (pelangganIds) {
      where.pelangganId = { in: pelangganIds };
    }

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
    const sortedPayments = limitPendingManualPayments(payments);
    const customerMap = await getCustomerNameMap(
      this.pelangganRepository,
      sortedPayments.map((payment) => payment.pelangganId),
    );

    return sortedPayments.map((payment) =>
      serializeManualPayment(
        payment,
        customerMap[payment.pelangganId] || "Pelanggan Tidak Diketahui",
      ),
    );
  }

  /** Verify a manual payment and trigger related invoice side effects. */
  async verifyManualPayment(input: {
    paymentId: string;
    action: string;
    notes?: string | null;
    allowedSiteIds?: string[];
  }) {
    const payment = await this.paymentRepository.findByIdWithInvoice(
      input.paymentId,
    );

    if (!payment || payment.gatewayStatus !== "PENDING") {
      throw createRouteServiceError(PAYMENT_NOT_FOUND_MESSAGE, 404);
    }

    // Validate scope: payment must belong to pelanggan in allowed sites
    if (input.allowedSiteIds && input.allowedSiteIds.length > 0) {
      const pelanggan = await this.pelangganRepository.findById(
        payment.pelangganId,
      );
      if (
        !pelanggan ||
        !pelanggan.siteId ||
        !input.allowedSiteIds.includes(pelanggan.siteId)
      ) {
        throw createRouteServiceError(
          "Anda tidak dapat memverifikasi payment untuk pelanggan di luar scope Anda",
          403,
        );
      }
    }

    if (input.action === "REJECT") {
      return rejectManualPayment(this.paymentRepository, payment, input.notes);
    }

    if (input.action === "APPROVE") {
      return approveManualPayment(
        this.paymentRepository,
        this.invoiceRepository,
        payment,
        input.notes,
      );
    }

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

    if (!investor) {
      return null;
    }

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

    if (!investor) {
      return null;
    }

    const { passwordHash: _passwordHash, ...safeInvestor } = investor;
    return safeInvestor;
  }
}
