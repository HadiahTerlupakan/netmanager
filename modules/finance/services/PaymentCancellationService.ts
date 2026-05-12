import { InvoiceStatus } from "../types/invoice.enums";
import { prismaBilling } from "@/modules/database";
import { sendCustomerPushNotification } from "@/modules/notification";
import { getPelangganService } from "@/modules/pelanggan";

export class PaymentCancellationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Cancels a paid payment and reverses related invoice/customer state. */
export async function cancelPaidPayment(options: {
  paymentId: string;
  adminLabel: string;
  allowedSiteIds?: string[];
}) {
  const payment = await findPaymentWithInvoice(options.paymentId);
  const invoice = payment.invoice;

  // Validate scope: payment must belong to pelanggan in allowed sites
  if (options.allowedSiteIds && options.allowedSiteIds.length > 0) {
    const pelanggan = await getPelangganService().getPelanggan(
      invoice.pelangganId,
    );
    if (
      !pelanggan ||
      !pelanggan.siteId ||
      !options.allowedSiteIds.includes(pelanggan.siteId)
    ) {
      throw new PaymentCancellationError(
        "Anda tidak dapat membatalkan payment untuk pelanggan di luar scope Anda",
        403,
      );
    }
  }

  const newPaidAmount = calculatePaidAmount(invoice.paidAmount, payment.amount);
  const newStatus = calculateInvoiceStatus(
    newPaidAmount,
    invoice.totalAmount,
    invoice.status,
  );

  await cancelPayment(options.paymentId, options.adminLabel);
  const updatedInvoice = await updateInvoice(
    invoice.id,
    newPaidAmount,
    newStatus,
  );
  const { syncInvoiceBillingSchedules } =
    await import("./billingScheduleLifecycle");
  await syncInvoiceBillingSchedules(updatedInvoice);
  await notifyCustomer(payment.id, invoice.id, invoice.pelangganId);
}

async function findPaymentWithInvoice(paymentId: string) {
  const payment = await prismaBilling.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });
  assertCancellablePayment(payment);
  return payment;
}

function assertCancellablePayment(
  payment: { gatewayStatus: string; invoice: unknown } | null,
) {
  if (!payment) {
    throw new PaymentCancellationError("Payment not found", 404);
  }
  if (payment.gatewayStatus !== "PAID") {
    throw new PaymentCancellationError(
      "Only PAID payments can be cancelled",
      400,
    );
  }
  if (!payment.invoice) {
    throw new PaymentCancellationError("Associated invoice not found", 404);
  }
}

function calculatePaidAmount(paidAmount: bigint, paymentAmount: bigint) {
  const diff = paidAmount - paymentAmount;
  return diff > 0n ? diff : 0n;
}

function calculateInvoiceStatus(
  paidAmount: bigint,
  totalAmount: bigint,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (paidAmount === 0n) {
    return InvoiceStatus.SENT;
  }

  if (paidAmount < totalAmount) {
    return InvoiceStatus.PARTIAL_PAID;
  }

  return currentStatus;
}

function cancelPayment(paymentId: string, adminLabel: string) {
  return prismaBilling.payment.update({
    where: { id: paymentId },
    data: {
      gatewayStatus: "CANCELLED",
      notes: `Cancelled by admin ${adminLabel} on ${new Date().toISOString()}`,
    },
  });
}

function updateInvoice(
  invoiceId: string,
  paidAmount: bigint,
  status: InvoiceStatus,
) {
  return prismaBilling.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      status,
      ...(status !== InvoiceStatus.PAID ? { paidAt: null } : {}),
    },
    select: {
      id: true,
      pelangganId: true,
      dueDate: true,
      status: true,
    },
  });
}

function notifyCustomer(
  paymentId: string,
  invoiceId: string,
  customerId: string,
) {
  return sendCustomerPushNotification(
    customerId,
    "Pembayaran Dibatalkan",
    "Pembayaran Anda telah dibatalkan oleh Admin.",
    { paymentId, invoiceId, action: "CANCEL" },
  );
}
