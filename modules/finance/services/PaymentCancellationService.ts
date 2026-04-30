import { InvoiceStatus } from "../types/invoice.enums";
import { prisma, prismaBilling } from "@/modules/database";
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
}) {
  const payment = await findPaymentWithInvoice(options.paymentId);
  const invoice = payment.invoice;
  const newPaidAmount = calculatePaidAmount(invoice.paidAmount, payment.amount);
  const newStatus = calculateInvoiceStatus(
    newPaidAmount,
    invoice.totalAmount,
    invoice.status,
  );

  await cancelPayment(options.paymentId, options.adminLabel);
  await updateInvoice(invoice.id, newPaidAmount, newStatus);
  await isolateCustomerIfNeeded(invoice, newStatus);
  await notifyCustomer(payment.id, invoice.id, invoice.pelangganId);
}

async function findPaymentWithInvoice(paymentId: string) {
  const payment = await prismaBilling.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });

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

  return payment;
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
    data: { paidAmount, status },
  });
}

type InvoiceForCancellation = {
  id: string;
  pelangganId: string;
  status: InvoiceStatus;
};

async function isolateCustomerIfNeeded(
  invoice: InvoiceForCancellation,
  newStatus: InvoiceStatus,
) {
  if (invoice.status !== InvoiceStatus.PAID) {
    return;
  }

  if (
    newStatus !== InvoiceStatus.SENT &&
    newStatus !== InvoiceStatus.PARTIAL_PAID
  ) {
    return;
  }

  const customer = await prisma.pelanggan.findUnique({
    where: { id: invoice.pelangganId },
  });

  if (customer && customer.status !== "ISOLIR") {
    await getPelangganService().updateStatusPelanggan(customer.id, "ISOLIR");
  }
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
