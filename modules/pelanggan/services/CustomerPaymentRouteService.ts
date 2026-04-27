import { couponService } from "@/modules/coupons";
import {
  createCustomerPaymentsForInvoices,
  PaymentGatewayManager,
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
  const payments = await createCustomerPaymentsForInvoices({
    customerId: input.customerId,
    tenantId: input.tenantId,
    invoiceIds: input.invoiceIds,
    discountAmount: coupon.discountAmount,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    couponId: coupon.couponId,
    couponService,
  });
  const gateway = await createGatewayPaymentIfNeeded({
    ...input,
    payments,
    finalAmount,
  });

  return {
    payments,
    paymentUrl: gateway.paymentUrl,
    transactionId: gateway.transactionId,
  };
}

async function resolveCoupon(input: CustomerPaymentInput, totalAmount: number) {
  if (!input.couponCode) {
    return { discountAmount: 0, couponId: null as string | null };
  }

  const verification = await couponService.verifyCoupon(
    input.couponCode,
    totalAmount,
    input.customerId,
  );

  if (!verification.valid) {
    throw new Error(verification.error || "Kupon tidak valid");
  }

  return {
    discountAmount: verification.discountAmount,
    couponId: verification.couponId,
  };
}

async function createGatewayPaymentIfNeeded(
  input: CustomerPaymentInput & {
    payments: Array<{ id: string; reference?: string | null }>;
    finalAmount: number;
  },
) {
  if (isManualPayment(input.paymentMethod) || input.payments.length === 0) {
    return { paymentUrl: null, transactionId: null };
  }

  try {
    const customer = await pelangganRepository.findById(input.customerId);
    if (!customer) {
      return { paymentUrl: null, transactionId: null };
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
      console.error("[Gateway Payment Error]:", result.error);
      return { paymentUrl: null, transactionId: null };
    }

    const paymentUrl = result.paymentUrl || result.qrCodeUrl || null;
    const transactionId = result.transactionId || null;

    if (transactionId || paymentUrl) {
      await updateCustomerPaymentGatewayMetadata({
        paymentIds: input.payments.map((payment) => payment.id),
        tenantId: input.tenantId,
        transactionId,
        paymentUrl,
        expiresAt: result.expiresAt ?? null,
        gatewayProvider: result.providerName ?? input.paymentMethod,
      });
    }

    return { paymentUrl, transactionId };
  } catch (error) {
    console.error("[Gateway Integration Error]:", error);
    return { paymentUrl: null, transactionId: null };
  }
}

function isManualPayment(paymentMethod: string) {
  return (
    paymentMethod === "MANUAL" ||
    paymentMethod === "MOOTA_MANUAL" ||
    paymentMethod.startsWith("MANUAL_")
  );
}
