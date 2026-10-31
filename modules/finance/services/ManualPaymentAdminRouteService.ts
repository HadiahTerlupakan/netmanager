import { PaymentRepository } from "../repositories/PaymentRepository";
import {
  findCheckoutPaymentRows,
  findVerifiablePayment,
} from "../repositories/manualPaymentVerification.repository";
import { getPelangganBillingBridge } from "../pelanggan-registry";
import { createRouteServiceError } from "@/lib/api/route-service-error";
import {
  buildPendingManualPaymentsWhere,
  getCustomerNameMap,
  getScopedPelangganIds,
  limitPendingManualPayments,
  serializeManualPayment,
  summarizeCheckouts,
  type PendingManualPaymentsInput,
} from "./manual-payment-admin.helpers";
import {
  approveManualCheckout,
  isManualTransferPayment,
  PAYMENT_NOT_FOUND_MESSAGE,
  rejectManualCheckout,
} from "./manual-payment-verification";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const INVALID_ACTION_MESSAGE = "Invalid action";
const NOT_MANUAL_TRANSFER_MESSAGE =
  "Hanya transfer manual yang bisa diverifikasi di sini";

export class ManualPaymentAdminRouteService {
  constructor(
    private readonly paymentRepository = new PaymentRepository(),
    private readonly pelangganRepository = getPelangganBillingBridge(),
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
      checkoutId: true,
      amount: true,
      gatewayStatus: true,
      paymentDate: true,
      paymentMethod: true,
      notes: true,
      rejectionReason: true,
      receiptUrl: true,
      createdAt: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          pelangganId: true,
          totalAmount: true,
          status: true,
        },
      },
    });
    const sortedPayments = limitPendingManualPayments(payments);
    const [customerMap, checkouts] = await Promise.all([
      getCustomerNameMap(
        this.pelangganRepository,
        sortedPayments.map((payment) => payment.pelangganId),
      ),
      this.findCheckoutSummaries(sortedPayments),
    ]);

    return sortedPayments.map((payment) =>
      serializeManualPayment(
        payment,
        customerMap[payment.pelangganId] || "Pelanggan Tidak Diketahui",
        payment.checkoutId ? checkouts.get(payment.checkoutId) : undefined,
      ),
    );
  }

  private async findCheckoutSummaries(
    payments: Array<{ checkoutId?: string | null }>,
  ) {
    const checkoutIds = [
      ...new Set(payments.flatMap((p) => (p.checkoutId ? [p.checkoutId] : []))),
    ];
    return summarizeCheckouts(await findCheckoutPaymentRows(checkoutIds));
  }

  /**
   * Setujui atau tolak bukti transfer manual untuk seluruh checkout-nya.
   * Checkout gateway (VA/QRIS) tidak bisa diverifikasi di sini: uangnya
   * hanya diakui dari webhook atau cek status gateway.
   */
  async verifyManualPayment(input: {
    paymentId: string;
    action: "APPROVE" | "REJECT";
    notes?: string | null;
    /** Alasan penolakan untuk pelanggan; klien lama mengirimnya di `notes`. */
    reason?: string | null;
    allowedSiteIds?: string[];
    verifiedBy?: string | null;
  }) {
    const payment = await findVerifiablePayment(input.paymentId);

    if (!payment || payment.gatewayStatus !== "PENDING") {
      throw createRouteServiceError(PAYMENT_NOT_FOUND_MESSAGE, HTTP_NOT_FOUND);
    }
    if (!isManualTransferPayment(payment)) {
      throw createRouteServiceError(
        NOT_MANUAL_TRANSFER_MESSAGE,
        HTTP_BAD_REQUEST,
      );
    }

    // Validate scope: payment must belong to pelanggan in allowed sites.
    // Daftar kosong berarti admin terbatas tanpa site, bukan tanpa batas:
    // dulu pemeriksaan dilewati dan admin itu bisa memverifikasi pembayaran
    // pelanggan site mana pun.
    if (input.allowedSiteIds) {
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
          HTTP_FORBIDDEN,
        );
      }
    }

    if (input.action === "REJECT") {
      return rejectManualCheckout(payment, {
        reason: input.reason ?? input.notes,
        verifiedBy: input.verifiedBy,
      });
    }

    if (input.action === "APPROVE") {
      return approveManualCheckout(payment, {
        notes: input.notes,
        verifiedBy: input.verifiedBy,
      });
    }

    throw createRouteServiceError(INVALID_ACTION_MESSAGE, HTTP_BAD_REQUEST);
  }
}
