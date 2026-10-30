import { logger } from "@/lib/logger";
import {
  createRouteServiceError,
  isRouteServiceError,
} from "@/lib/api/route-service-error";
import { eventBus, EVENT_NAMES } from "@/lib/event-bus";
import { couponService } from "@/modules/coupons";
import {
  findPaymentMethodProvider,
  replacePendingGatewayCheckouts,
  withCustomerCheckoutLock,
} from "@/modules/payment-gateway";
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
  qrString?: string;
  vaNumber?: string;
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
const BELOW_METHOD_MINIMUM_MESSAGE =
  "Nominal tagihan di bawah batas minimum metode pembayaran ini. Silakan pilih metode lain, misalnya QRIS.";
// Duitku: "Minimum Payment 10000 IDR". Batasnya per channel (VA menolak,
// QRIS menerima nominal yang sama), jadi tidak bisa diperiksa sebelum memanggil.
const BELOW_MINIMUM_REJECTION = /minimum payment/i;

const customerPortalService = new CustomerPortalService();
const pelangganRepository = new PelangganRepository();

/** Creates customer portal payments and optional payment gateway metadata. */
export function createCustomerPaymentForRoute(input: CustomerPaymentInput) {
  return withCustomerCheckoutLock(input.customerId, () =>
    createCustomerPayment(input),
  );
}

async function createCustomerPayment(input: CustomerPaymentInput) {
  const { totalAmount } =
    await customerPortalService.validateInvoicesForPayment(
      input.invoiceIds,
      input.customerId,
    );
  // Membayar lagi invoice yang masih punya checkout gateway menunggu berarti
  // ganti metode; checkout lama ditutup sebelum kupon diverifikasi ulang.
  await replacePendingGatewayCheckouts(input);
  const coupon = await resolveCoupon(input, totalAmount);
  const finalAmount = totalAmount - coupon.discountAmount;
  // Kuota dipesan sebelum payment dibuat: payment yang tertutup penuh oleh
  // kupon langsung PAID, jadi kupon harus sudah sah lebih dulu.
  const usageId = await reserveCoupon(input, coupon);

  let payments: Awaited<ReturnType<typeof createCustomerPaymentsForInvoices>>;
  let gateway: GatewayCheckout;
  try {
    payments = await createCustomerPaymentsForInvoices({
      customerId: input.customerId,
      tenantId: input.tenantId,
      invoiceIds: input.invoiceIds,
      discountAmount: coupon.discountAmount,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      couponUsageId: usageId,
      couponId: coupon.couponId,
    });
    gateway = await createGatewayPaymentIfNeeded({
      ...input,
      payments,
      finalAmount,
    });
  } catch (error) {
    // Kupon di database utama, payment di database billing: tidak bisa satu
    // transaksi, jadi pesanan kuota dibatalkan manual bila pembayaran gagal.
    await releaseCoupon(usageId);
    throw error;
  }

  await settleFullyDiscountedPayments(payments);
  await publishCouponUsed(input, coupon, usageId);

  return { payments, ...gateway };
}

type GatewayCheckout = {
  paymentUrl: string | null;
  transactionId: string | null;
  vaNumber: string | null;
  qrString: string | null;
};

const NO_GATEWAY_CHECKOUT: GatewayCheckout = {
  paymentUrl: null,
  transactionId: null,
  vaNumber: null,
  qrString: null,
};

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

async function releaseCoupon(usageId: string | null) {
  if (!usageId) {
    return;
  }

  try {
    await couponService.releaseUsage(usageId);
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

async function createGatewayPaymentIfNeeded(
  input: GatewayPaymentInput,
): Promise<GatewayCheckout> {
  if (
    isManualPayment(input.paymentMethod) ||
    input.payments.length === 0 ||
    input.finalAmount <= 0
  ) {
    return NO_GATEWAY_CHECKOUT;
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
    if (isRouteServiceError(error)) {
      throw error;
    }
    throw createRouteServiceError(GATEWAY_FAILED_MESSAGE, HTTP_BAD_GATEWAY);
  }
}

async function requestGatewayPayment(
  input: GatewayPaymentInput,
  paymentIds: string[],
): Promise<GatewayCheckout> {
  const customer = await pelangganRepository.findById(input.customerId);
  if (!customer) {
    throw new Error(`Pelanggan ${input.customerId} tidak ditemukan`);
  }

  const gatewayManager = new PaymentGatewayManager();
  const params = {
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
  };
  // Kode metode menentukan gateway-nya; tanpa ini tenant dengan beberapa
  // gateway selalu ditagih lewat gateway pertama, yang tidak mengenal kode
  // channel gateway lain.
  const provider = findPaymentMethodProvider(input.paymentMethod);
  const result = (await (provider
    ? gatewayManager.createPaymentWithProvider(provider, params)
    : gatewayManager.createPayment(params))) as GatewayPaymentResult;

  if (!result.success) {
    const rejection = String(result.error);
    if (BELOW_MINIMUM_REJECTION.test(rejection)) {
      logger.warn("[Gateway] Nominal di bawah minimum metode:", rejection);
      throw createRouteServiceError(
        BELOW_METHOD_MINIMUM_MESSAGE,
        HTTP_BAD_REQUEST,
      );
    }
    throw new Error(`Payment gateway menolak: ${rejection}`);
  }

  const paymentUrl = result.paymentUrl || result.qrCodeUrl || null;
  const transactionId = result.transactionId || null;
  const vaNumber = result.vaNumber || null;
  const qrString = result.qrString || null;

  if (transactionId || paymentUrl) {
    await updateCustomerPaymentGatewayMetadata({
      paymentIds,
      tenantId: input.tenantId,
      transactionId,
      paymentUrl,
      vaNumber,
      qrString,
      expiresAt: result.expiresAt ?? null,
      gatewayProvider: result.providerName ?? input.paymentMethod,
    });
  }

  return { paymentUrl, transactionId, vaNumber, qrString };
}

function isManualPayment(paymentMethod: string) {
  return (
    paymentMethod === "MANUAL" ||
    paymentMethod === "MOOTA_MANUAL" ||
    paymentMethod.startsWith("MANUAL_")
  );
}
