import { logger } from "@/lib/logger";
import { createRouteServiceError } from "@/lib/api/route-service-error";
import { eventBus, EVENT_NAMES } from "@/lib/event-bus";
import { couponService } from "@/modules/coupons";
import {
  createCustomerPaymentsForInvoices,
  markCustomerPaymentsAsFailed,
  PaymentGatewayManager,
  recomputeInvoicePaymentState,
  updateCustomerPaymentGatewayMetadata,
} from "@/modules/finance";
import { PelangganRepository } from "../repositories/PelangganRepository";
import { CustomerPortalService } from "./CustomerPortalService";

type GatewayPaymentResult = {
  success: boolean;
  paymentUrl?: string;
  qrCodeUrl?: string;
  expiresAt?: Date;
  transactionId?: string;
  providerName?: string;
  error?: unknown;
};

type CustomerPaymentInput = {
  customerId: string;
  tenantId?: string | null;
  invoiceIds: string[];
  couponCode?: string | null;
  paymentMethod: string;
  notes?: string | null;
};

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const EXHAUSTED_COUPON_MESSAGE = "Kuota kupon habis";
const GATEWAY_FAILED_MESSAGE =
  "Gagal menghubungi payment gateway. Silakan coba lagi atau gunakan metode pembayaran lain.";

const customerPortalService = new CustomerPortalService();
const pelangganRepository = new PelangganRepository();

/** Creates customer portal payments and optional payment gateway metadata. */
export async function createCustomerPaymentForRoute(
  input: CustomerPaymentInput,
) {
  const { totalAmount } =
    await customerPortalService.validateInvoicesForPayment(
      input.invoiceIds,
      input.customerId,
    );
  const coupon = await resolveCoupon(input, totalAmount);
  const finalAmount = totalAmount - coupon.discountAmount;
  // Kuota dipesan sebelum payment dibuat: payment yang tertutup penuh oleh
  // kupon langsung PAID, jadi kupon harus sudah sah lebih dulu.
  const usageId = await reserveCoupon(input, coupon);

  let payments: Awaited<ReturnType<typeof createCustomerPaymentsForInvoices>>;
  let gateway: { paymentUrl: string | null; transactionId: string | null };
  try {
    payments = await createCustomerPaymentsForInvoices({
      customerId: input.customerId,
      tenantId: input.tenantId,
      invoiceIds: input.invoiceIds,
      discountAmount: coupon.discountAmount,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    });
    gateway = await createGatewayPaymentIfNeeded({
      ...input,
      payments,
      finalAmount,
    });
  } catch (error) {
    // Kupon di database utama, payment di database billing: tidak bisa satu
    // transaksi, jadi pesanan kuota dibatalkan manual bila pembayaran gagal.
    await releaseCoupon(usageId, coupon);
    throw error;
  }

  await settleFullyDiscountedPayments(payments);
  await publishCouponUsed(input, coupon, usageId);

  return {
    payments,
    paymentUrl: gateway.paymentUrl,
    transactionId: gateway.transactionId,
  };
}

type ResolvedCoupon = { discountAmount: number; couponId: string | null };

async function reserveCoupon(
  input: CustomerPaymentInput,
  coupon: ResolvedCoupon,
) {
  if (!coupon.couponId || coupon.discountAmount <= 0) {
    return null;
  }

  const usageId = await couponService.reserveUsage(
    coupon.couponId,
    input.customerId,
  );
  if (!usageId) {
    throw createRouteServiceError(EXHAUSTED_COUPON_MESSAGE, HTTP_BAD_REQUEST);
  }
  return usageId;
}

async function releaseCoupon(usageId: string | null, coupon: ResolvedCoupon) {
  if (!usageId || !coupon.couponId) {
    return;
  }

  try {
    await couponService.releaseUsage(usageId, coupon.couponId);
  } catch (error) {
    // Pembayaran sudah gagal dan error aslinya dilempar ulang; kuota yang
    // tertahan satu terlihat di riwayat pemakaian kupon.
    logger.error("[Coupon] Gagal membatalkan pemakaian kupon:", error);
  }
}

// Payment yang tertutup penuh oleh kupon dibuat langsung PAID; invoice-nya
// perlu dihitung ulang agar lunas dan pelanggan isolir aktif kembali.
async function settleFullyDiscountedPayments(
  payments: Array<{ invoiceId?: string | null; gatewayStatus?: string | null }>,
) {
  for (const payment of payments) {
    if (payment.gatewayStatus === "PAID" && payment.invoiceId) {
      await recomputeInvoicePaymentState(payment.invoiceId);
    }
  }
}

async function publishCouponUsed(
  input: CustomerPaymentInput,
  coupon: ResolvedCoupon,
  usageId: string | null,
) {
  if (!usageId || !coupon.couponId) {
    return;
  }

  await eventBus.publish(EVENT_NAMES.COUPON_USED, {
    couponId: coupon.couponId,
    pelangganId: input.customerId,
    invoiceIds: input.invoiceIds,
    discountAmount: coupon.discountAmount,
    appliedAt: new Date().toISOString(),
    tenantId: input.tenantId ?? undefined,
  });
}

async function resolveCoupon(
  input: CustomerPaymentInput,
  totalAmount: number,
): Promise<ResolvedCoupon> {
  if (!input.couponCode) {
    return { discountAmount: 0, couponId: null };
  }

  // `findByCode` tanpa tenantId mencari di semua tenant; sama seperti rute
  // verifikasi kupon pelanggan, tolak daripada memakai kupon milik ISP lain.
  if (!input.tenantId) {
    throw createRouteServiceError(
      "Tenant ID tidak ditemukan",
      HTTP_BAD_REQUEST,
    );
  }

  const verification = await couponService.verifyCoupon(
    input.couponCode,
    totalAmount,
    input.customerId,
    input.tenantId,
  );

  // Penolakan kupon (kuota habis, kedaluwarsa, minimal belanja) adalah
  // kesalahan input pelanggan; tanpa status rute menjawabnya 500.
  if (!verification.valid) {
    throw createRouteServiceError(
      verification.error || "Kupon tidak valid",
      HTTP_BAD_REQUEST,
    );
  }

  return {
    discountAmount: verification.discountAmount,
    couponId: verification.couponId,
  };
}

type GatewayPaymentInput = CustomerPaymentInput & {
  payments: Array<{ id: string; reference?: string | null }>;
  finalAmount: number;
};

async function createGatewayPaymentIfNeeded(input: GatewayPaymentInput) {
  if (
    isManualPayment(input.paymentMethod) ||
    input.payments.length === 0 ||
    input.finalAmount <= 0
  ) {
    return { paymentUrl: null, transactionId: null };
  }

  const paymentIds = input.payments.map((payment) => payment.id);
  try {
    return await requestGatewayPayment(input, paymentIds);
  } catch (error) {
    // Payment PENDING tanpa URL tidak bisa dibayar pelanggan namun tetap
    // tampil sebagai tagihan menunggu; tandai FAILED agar pelanggan bisa
    // mencoba lagi atau memilih transfer manual.
    logger.error("[Gateway Integration Error]:", error);
    await markCustomerPaymentsAsFailed(paymentIds);
    throw createRouteServiceError(GATEWAY_FAILED_MESSAGE, HTTP_BAD_GATEWAY);
  }
}

async function requestGatewayPayment(
  input: GatewayPaymentInput,
  paymentIds: string[],
) {
  const customer = await pelangganRepository.findById(input.customerId);
  if (!customer) {
    throw new Error(`Pelanggan ${input.customerId} tidak ditemukan`);
  }

  const gatewayManager = new PaymentGatewayManager();
  const result = (await gatewayManager.createPayment({
    orderId: input.payments[0].reference || input.payments[0].id,
    amount: Number(input.finalAmount),
    customerName: customer.nama,
    customerEmail: customer.email
      ? String(customer.email)
      : "customer@example.com",
    customerPhone: customer.noTelp ? String(customer.noTelp) : "",
    description: "Pembayaran Tagihan NetManager",
    paymentMethods: [input.paymentMethod],
    tenantId: input.tenantId || undefined,
  })) as GatewayPaymentResult;

  if (!result.success) {
    throw new Error(`Payment gateway menolak: ${String(result.error)}`);
  }

  const paymentUrl = result.paymentUrl || result.qrCodeUrl || null;
  const transactionId = result.transactionId || null;

  if (transactionId || paymentUrl) {
    await updateCustomerPaymentGatewayMetadata({
      paymentIds,
      tenantId: input.tenantId,
      transactionId,
      paymentUrl,
      expiresAt: result.expiresAt ?? null,
      gatewayProvider: result.providerName ?? input.paymentMethod,
    });
  }

  return { paymentUrl, transactionId };
}

function isManualPayment(paymentMethod: string) {
  return (
    paymentMethod === "MANUAL" ||
    paymentMethod === "MOOTA_MANUAL" ||
    paymentMethod.startsWith("MANUAL_")
  );
}
