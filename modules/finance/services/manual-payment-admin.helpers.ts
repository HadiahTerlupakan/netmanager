import { sendCustomerPushNotification } from "@/modules/notification";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import type { PelangganBillingBridgeService } from "@/modules/pelanggan";
import type { PaymentEntity } from "../domain/entities/PaymentEntity";
import type {
  PaymentWhereInput,
  GatewayPaymentStatus,
} from "../types/payment.types";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";

export type PendingManualPaymentsInput = {
  startDate?: string | null;
  endDate?: string | null;
  siteId?: string | null;
  status?: string | null;
  isSiteOnly?: boolean;
};

type PaymentRecord = PaymentEntity & {
  invoice?: (PaymentEntity["invoice"] & { totalAmount: bigint }) | null;
};

const MAX_PENDING_MANUAL_PAYMENTS = 500;
const EMPTY_SCOPE: string[] = [];
const REJECTED_GATEWAY_STATUSES: GatewayPaymentStatus[] = [
  "FAILED",
  "CANCELLED",
];

export function buildPendingManualPaymentsWhere(
  input: PendingManualPaymentsInput,
): PaymentWhereInput {
  const where: PaymentWhereInput = { receiptUrl: { not: null } };

  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    start.setTime(toStartOfDay(start).getTime());
    const end = new Date(input.endDate);
    end.setTime(toEndOfDay(end).getTime());
    where.createdAt = { gte: start, lte: end };
  }

  const gatewayStatus = mapGatewayStatusFilter(input.status);
  if (gatewayStatus) {
    where.gatewayStatus = gatewayStatus;
  }

  return where;
}

export function limitPendingManualPayments<T extends { createdAt: Date }>(
  payments: T[],
) {
  return payments
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, MAX_PENDING_MANUAL_PAYMENTS);
}

export function serializeManualPayment(
  payment: PaymentRecord,
  customerName: string,
) {
  return {
    ...payment,
    amount: payment.amount.toString(),
    invoice: payment.invoice
      ? {
          ...payment.invoice,
          totalAmount: payment.invoice.totalAmount.toString(),
        }
      : null,
    customerName,
  };
}

export async function getScopedPelangganIds(
  pelangganRepository: PelangganBillingBridgeService,
  siteId?: string | null,
  isSiteOnly?: boolean,
) {
  if (isSiteOnly && !siteId) {
    return EMPTY_SCOPE;
  }

  if (!siteId) {
    return null;
  }

  const pelanggans = await pelangganRepository.findBySiteId(siteId);
  return pelanggans.map((pelanggan) => pelanggan.id);
}

type CustomerNameRecord = {
  id: string;
  nama: string;
};

export async function getCustomerNameMap(
  pelangganRepository: PelangganBillingBridgeService,
  pelangganIds: string[],
) {
  if (pelangganIds.length === 0) {
    return {} as Record<string, string>;
  }

  const uniqueIds = Array.from(new Set(pelangganIds));
  const customers = (await pelangganRepository.findManyByIds(
    uniqueIds,
  )) as Array<CustomerNameRecord>;

  return customers.reduce<Record<string, string>>((nameMap, customer) => {
    nameMap[customer.id] = customer.nama;
    return nameMap;
  }, {});
}

export async function rejectManualPayment(
  paymentRepository: {
    updatePaymentById: (
      id: string,
      data: Record<string, unknown>,
    ) => Promise<unknown>;
  },
  payment: PaymentRecord,
  notes?: string | null,
) {
  await paymentRepository.updatePaymentById(payment.id, {
    gatewayStatus: "FAILED",
    notes: notes || payment.notes || null,
  });

  if (payment.invoice?.pelangganId) {
    await sendCustomerPushNotification(
      payment.invoice.pelangganId,
      "Pembayaran Ditolak",
      "Pembayaran Anda ditolak. Mohon periksa kembali bukti transfer Anda.",
      {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        action: "REJECT",
      },
    );
  }

  return { success: true, message: "Payment rejected" };
}

export async function approveManualPayment(
  paymentRepository: {
    updatePaymentById: (
      id: string,
      data: Record<string, unknown>,
    ) => Promise<unknown>;
  },
  invoiceRepository: InvoiceRepository,
  payment: PaymentRecord,
  notes?: string | null,
) {
  await paymentRepository.updatePaymentById(payment.id, {
    gatewayStatus: "PAID",
    paymentDate: new Date(),
    notes: notes || payment.notes || null,
  });

  if (payment.invoiceId) {
    await new InvoicePaymentStateService(invoiceRepository).recompute(
      payment.invoiceId,
    );

    if (payment.invoice?.pelangganId) {
      await sendCustomerPushNotification(
        payment.invoice.pelangganId,
        "Pembayaran Berhasil!",
        "Tagihan Anda telah dilunasi.",
        {
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          action: "APPROVE",
        },
      );
    }
  }

  return { success: true, message: "Payment approved" };
}

function mapGatewayStatusFilter(
  status?: string | null,
): PaymentWhereInput["gatewayStatus"] {
  if (status === "PENDING") {
    return "PENDING";
  }

  if (status === "APPROVED") {
    return "PAID";
  }

  if (status === "REJECTED") {
    return { in: REJECTED_GATEWAY_STATUSES };
  }

  return undefined;
}
