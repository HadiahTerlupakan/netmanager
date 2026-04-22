import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { prisma } from "@/modules/database";
import { prismaBilling } from "@/modules/database";
import { CustomerPortalService } from "@/modules/pelanggan";
import { CouponService } from "@/modules/coupons";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";
import {
  GatewayPaymentStatus,
  PaymentMethod,
  type GatewayPaymentStatus as GatewayPaymentStatusValue,
  type PaymentMethod as PaymentMethodValue,
} from "@/prisma/generated/billing";

type GatewayPaymentResult = {
  success: boolean;
  paymentUrl?: string;
  qrCodeUrl?: string;
  expiresAt?: Date;
  transactionId?: string;
  providerName?: string;
};

const customerPortalService = new CustomerPortalService();
const couponService = new CouponService();

function resolvePaymentMethod(paymentMethod: string): PaymentMethodValue {
  if (
    paymentMethod.startsWith("MANUAL_") ||
    paymentMethod === "MANUAL" ||
    paymentMethod === "MOOTA_MANUAL"
  ) {
    return PaymentMethod.BANK_TRANSFER;
  }

  return (
    PaymentMethod[paymentMethod as keyof typeof PaymentMethod] ??
    PaymentMethod.OTHER
  );
}

function resolveGatewayStatus(): GatewayPaymentStatusValue {
  return GatewayPaymentStatus.PENDING;
}

function resolveGatewayMetadata(
  gatewayResult: GatewayPaymentResult,
  paymentMethod: string,
) {
  return {
    expiresAt: gatewayResult.expiresAt ?? null,
    gatewayProvider: gatewayResult.providerName ?? paymentMethod,
  };
}

/**
 * GET - Get payment history
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const result = await customerPortalService.getPaymentHistory(
      authResult.session.id,
      page,
      limit,
    );

    return apiSuccess(result);
  } catch (error) {
    const err = error as Error;
    console.error("[Customer Payments GET Error]:", err);
    return ApiErrors.internalError(err.message || "Terjadi kesalahan server");
  }
}

/**
 * POST - Create payment
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const json = await request.json();
    const { invoiceIds, couponCode, paymentMethod, notes } = json;
    const { tenantId } = await getTenantIdFromContext();

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return apiError(
        "Pilih minimal satu tagihan untuk dibayar",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const { totalAmount } =
      await customerPortalService.validateInvoicesForPayment(
        invoiceIds,
        authResult.session.id,
      );

    let discountAmount = 0;
    let couponId = null;

    if (couponCode) {
      const verification = await couponService.verifyCoupon(
        couponCode,
        totalAmount,
        authResult.session.id,
      );

      if (!verification.valid) {
        return apiError(
          verification.error || "Kupon tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      discountAmount = verification.discountAmount;
      couponId = verification.couponId;
    }

    const finalAmount = totalAmount - discountAmount;

    const result = await prismaBilling.$transaction(async (tx) => {
      const discountPerInvoice =
        discountAmount > 0 ? Math.floor(discountAmount / invoiceIds.length) : 0;

      const payments = [];

      for (let i = 0; i < invoiceIds.length; i++) {
        const invoiceId = invoiceIds[i];

        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
        });

        if (!invoice) continue;

        const currentDiscount =
          i === invoiceIds.length - 1 && discountAmount > 0
            ? discountAmount - discountPerInvoice * (invoiceIds.length - 1)
            : discountPerInvoice;

        const currentFinalAmount =
          Number(invoice.totalAmount) - currentDiscount;

        const currentPaymentMethod = resolvePaymentMethod(paymentMethod);
        const currentGatewayStatus = resolveGatewayStatus();
        const currentAccountId = paymentMethod.startsWith("MANUAL_")
          ? paymentMethod.replace("MANUAL_", "")
          : null;

        const payment = await tx.payment.create({
          data: {
            id: crypto.randomUUID(),
            updatedAt: new Date(),
            amount: currentFinalAmount,
            paymentDate: new Date(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paymentMethod: currentPaymentMethod as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gatewayStatus: currentGatewayStatus as any,
            accountId: currentAccountId,
            reference: `PAY-${crypto.randomUUID()}`,
            notes: notes,
            pelangganId: authResult.session.id,
            invoiceId: invoiceId,
            tenantId: tenantId || undefined,
          },
        });

        payments.push(payment);
      }

      if (couponId) {
        await couponService.recordUsage(couponId, authResult.session.id, tx);
        await couponService.incrementUsage(couponId, tx);
      }

      return payments;
    });

    let paymentUrl = null;
    let transactionId = null;

    if (
      paymentMethod !== "MANUAL" &&
      paymentMethod !== "MOOTA_MANUAL" &&
      !paymentMethod.startsWith("MANUAL_") &&
      result.length > 0
    ) {
      try {
        const customer = await prisma.pelanggan.findUnique({
          where: { id: authResult.session.id },
        });

        if (customer) {
          const { PaymentGatewayManager } = await import("@/modules/finance");
          const gatewayManager = new PaymentGatewayManager();

          const customerEmail = customer.email
            ? String(customer.email)
            : "customer@example.com";
          const customerPhone = customer.noTelp ? String(customer.noTelp) : "";

          const gatewayResult = await gatewayManager.createPayment({
            orderId: result[0].reference || result[0].id,
            amount: Number(finalAmount),
            customerName: customer.nama,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            description: `Pembayaran Tagihan NetManager`,
            paymentMethods: [paymentMethod],
            tenantId: tenantId || undefined,
          });

          if (gatewayResult.success) {
            const gatewayMetadata = resolveGatewayMetadata(
              gatewayResult as GatewayPaymentResult,
              paymentMethod,
            );

            paymentUrl =
              gatewayResult.paymentUrl || gatewayResult.qrCodeUrl || null;
            transactionId = gatewayResult.transactionId || null;

            if (transactionId || paymentUrl) {
              const paymentIds = result.map((p) => p.id);
              await prismaBilling.payment.updateMany({
                where: {
                  id: { in: paymentIds },
                  ...(tenantId ? { tenantId } : {}),
                },
                data: {
                  transactionId,
                  paymentUrl,
                  expiresAt: gatewayMetadata.expiresAt,
                  gatewayProvider: gatewayMetadata.gatewayProvider,
                },
              });
            }
          } else {
            console.error("[Gateway Payment Error]:", gatewayResult.error);
          }
        }
      } catch (gatewayErr) {
        console.error("[Gateway Integration Error]:", gatewayErr);
      }
    }

    return apiSuccess(
      {
        payments: result,
        paymentUrl,
        transactionId,
      },
      {
        message: paymentUrl
          ? "Menunggu pembayaran via gateway"
          : "Pembayaran berhasil diproses",
      },
    );
  } catch (error) {
    const err = error as Error;
    console.error("[Payment Create Error]:", err);

    if (err.message === "Beberapa tagihan tidak valid atau sudah dibayar") {
      return apiError(err.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    return ApiErrors.internalError(err.message || "Gagal memproses pembayaran");
  }
}
