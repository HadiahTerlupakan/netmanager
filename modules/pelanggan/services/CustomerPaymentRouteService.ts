import { logger } from "@/lib/logger";
import { createRouteServiceError } from "@/lib/api/route-service-error";
import { eventBus, EVENT_NAMES } from "@/lib/event-bus";
import { couponService } from "@/modules/coupons";
import {
  closeReplacedCheckouts,
  findPaymentMethodProvider,
  findReplaceableCheckouts,
  resolveGatewayReturnUrl,
  selectGatewayOrderPayment,
  withCustomerCheckoutLock,
  type CheckoutReturnTarget,
  type ReplaceableCheckouts,
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
  returnTo?: CheckoutReturnTarget;
};

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const EXHAUSTED_COUPON_MESSAGE = "Kuota kupon habis";
const GATEWAY_FAILED_MESSAGE =
  "Gagal menghubungi payment gateway. Silakan coba lagi atau gunakan metode pembayaran lain.";
const BELOW_METHOD_MINIMUM_MESSAGE =
  "Nominal tagihan di bawah batas minimum metode pembayaran ini. Silakan pilih metode lain, misalnya QRIS.";
const CHANNEL_UNAVAILABLE_MESSAGE =
  "Metode pembayaran ini sedang tidak tersedia. Silakan pilih metode lain.";
// Duitku: "Minimum Payment 10000 IDR". Batasnya per channel (VA menolak,
// QRIS menerima nominal yang sama), jadi tidak bisa diperiksa sebelum memanggil.
const BELOW_MINIMUM_REJECTION = /minimum payment/i;
// Duitku menjawab "Payment channel not available" (HTTP 404) untuk kanal yang
// belum diaktifkan merchant; produksi 2026-10-31: DANA, ShopeePay, dan FT.
const CHANNEL_UNAVAILABLE_REJECTION =
  /\b(channel|method)\b[^.]*\b(not (available|active|enabled)|inactive|disabled)\b/i;

const customerPortalService = new CustomerPortalService();
const pelangganRepository = new PelangganRepository();

/** Penolakan gateway atas permintaan checkout, dengan teks aslinya. */
class GatewayRejectionError extends Error {}

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
  // Membayar lagi invoice yang masih punya checkout menunggu berarti ganti
  // metode. Checkout lama baru ditutup setelah penggantinya berhasil dibuat,
  // jadi VA/QR lamanya tetap tampil bila gateway menolak metode baru.
  const previous = await findReplaceableCheckouts(input);
  const coupon = await resolveCoupon(input, totalAmount, previous);
  const finalAmount = totalAmount - coupon.discountAmount;
  // Kuota dipesan sebelum payment dibuat: payment yang tertutup penuh oleh
  // kupon langsung PAID, jadi kupon harus sudah sah lebih dulu.
  const usage = await reserveCoupon(input, coupon, previous);

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
      couponUsageId: usage.usageId,
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
    // Pemesanan yang dipindah tetap milik checkout lama yang masih terbuka.
    if (!usage.isMoved) await releaseCoupon(usage.usageId);
    throw error;
  }

  await closeReplacedCheckouts(previous, {
    keptCouponUsageId: usage.isMoved ? usage.usageId : null,
  });
  await settleFullyDiscountedPayments(payments);
  await publishCouponUsed(input, coupon, usage.usageId);

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
type CouponReservation = { usageId: string | null; isMoved: boolean };

// Kupon yang sama dengan milik checkout yang diganti memakai pemesanan lama;
// memesan lagi membuat kupon berkuota satu ditolak saat ganti metode.
async function reserveCoupon(
  input: CustomerPaymentInput,
  coupon: ResolvedCoupon,
  previous: ReplaceableCheckouts,
): Promise<CouponReservation> {
  if (!coupon.couponId || coupon.discountAmount <= 0) {
    return { usageId: null, isMoved: false };
  }
  if (previous.heldCoupon?.couponId === coupon.couponId) {
    return { usageId: previous.heldCoupon.couponUsageId, isMoved: true };
  }

  const usageId = await couponService.reserveUsage(
    coupon.couponId,
    input.customerId,
  );
  if (!usageId) {
    throw createRouteServiceError(EXHAUSTED_COUPON_MESSAGE, HTTP_BAD_REQUEST);
  }
  return { usageId, isMoved: false };
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
  previous: ReplaceableCheckouts,
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
    previous.heldCoupon?.couponId,
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
  const orderPayment = selectGatewayOrderPayment(input.payments);
  if (
    isManualPayment(input.paymentMethod) ||
    !orderPayment ||
    input.finalAmount <= 0
  ) {
    return NO_GATEWAY_CHECKOUT;
  }

  const paymentIds = input.payments.map((payment) => payment.id);
  try {
    const result = await requestGatewayPayment(input, orderPayment);
    if (!result.success) {
      throw new GatewayRejectionError(String(result.error));
    }
    return await storeGatewayCheckout(input, paymentIds, result);
  } catch (error) {
    // Payment PENDING tanpa URL tidak bisa dibayar pelanggan namun tetap
    // tampil sebagai tagihan menunggu; tandai FAILED, beserta alasan dari
    // gateway untuk admin, agar pelanggan bisa memilih metode lain.
    logger.error("[Gateway Integration Error]:", error);
    await markCustomerPaymentsAsFailed(
      paymentIds,
      error instanceof Error ? error.message : String(error),
    );
    throw toCustomerGatewayError(error);
  }
}

// Pelanggan diberi pesan sesuai kategorinya; teks gateway hanya untuk admin.
function toCustomerGatewayError(error: unknown) {
  if (error instanceof GatewayRejectionError) {
    if (BELOW_MINIMUM_REJECTION.test(error.message)) {
      return createRouteServiceError(
        BELOW_METHOD_MINIMUM_MESSAGE,
        HTTP_BAD_REQUEST,
      );
    }
    if (CHANNEL_UNAVAILABLE_REJECTION.test(error.message)) {
      return createRouteServiceError(
        CHANNEL_UNAVAILABLE_MESSAGE,
        HTTP_BAD_GATEWAY,
      );
    }
  }
  return createRouteServiceError(GATEWAY_FAILED_MESSAGE, HTTP_BAD_GATEWAY);
}

async function requestGatewayPayment(
  input: GatewayPaymentInput,
  orderPayment: GatewayPaymentInput["payments"][number],
): Promise<GatewayPaymentResult> {
  const customer = await pelangganRepository.findById(input.customerId);
  if (!customer) {
    throw new Error(`Pelanggan ${input.customerId} tidak ditemukan`);
  }

  const params = {
    orderId: orderPayment.reference || orderPayment.id,
    amount: Number(input.finalAmount),
    customerName: customer.nama,
    customerEmail: customer.email
      ? String(customer.email)
      : "customer@example.com",
    customerPhone: customer.noTelp ? String(customer.noTelp) : "",
    description: "Pembayaran Tagihan NetManager",
    paymentMethods: [input.paymentMethod],
    tenantId: input.tenantId || undefined,
    returnUrl: resolveGatewayReturnUrl(input.returnTo),
  };
  // Kode metode menentukan gateway-nya; tanpa ini tenant dengan beberapa
  // gateway selalu ditagih lewat gateway pertama, yang tidak mengenal kode
  // channel gateway lain.
  const gatewayManager = new PaymentGatewayManager();
  const provider = findPaymentMethodProvider(input.paymentMethod);
  return (await (provider
    ? gatewayManager.createPaymentWithProvider(provider, params)
    : gatewayManager.createPayment(params))) as GatewayPaymentResult;
}

async function storeGatewayCheckout(
  input: GatewayPaymentInput,
  paymentIds: string[],
  result: GatewayPaymentResult,
): Promise<GatewayCheckout> {
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
