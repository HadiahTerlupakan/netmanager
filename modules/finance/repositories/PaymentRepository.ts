import { randomUUID } from "crypto";
import { prismaBilling, prismaBillingAuth } from "@/lib/prisma-billing";
import {
  GatewayPaymentStatus,
  PaymentMethod,
  type Prisma,
  type Payment,
} from "@prisma/client-billing";
import type { IPaymentRepository } from "../domain/ports/IPaymentRepository";
import type { PaymentEntity } from "../domain/entities/PaymentEntity";

type CustomerPaymentCouponService = {
  recordUsage(
    couponId: string,
    customerId: string,
    tx: unknown,
  ): Promise<unknown>;
  incrementUsage(couponId: string, tx: unknown): Promise<unknown>;
};

export class PaymentRepository implements IPaymentRepository {
  /** Mengambil pembayaran dalam rentang tanggal pembayaran. */
  async findManyByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentEntity[]> {
    const payments = await prismaBilling.payment.findMany({
      where: {
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
    return payments.map(mapPaymentEntity);
  }

  /** Mengambil banyak data pembayaran berdasarkan filter opsional. */
  async findMany(
    where: Prisma.PaymentWhereInput,
    select?: Prisma.PaymentSelect,
  ) {
    return prismaBilling.payment.findMany({
      where,
      ...(select ? { select } : {}),
    });
  }

  /** Mengambil pembayaran transfer manual pending milik pelanggan. */
  async findPendingManualTransfer(options: {
    invoiceId: string;
    pelangganId: string;
  }): Promise<PaymentEntity | null> {
    const payment = await prismaBilling.payment.findFirst({
      where: {
        invoiceId: options.invoiceId,
        pelangganId: options.pelangganId,
        gatewayStatus: "PENDING",
        paymentMethod: "BANK_TRANSFER",
      },
    });
    return payment ? mapPaymentEntity(payment) : null;
  }

  /** Memperbarui bukti pembayaran pelanggan. */
  async updateReceipt(options: {
    paymentId: string;
    receiptUrl: string;
    notes: string;
  }): Promise<PaymentEntity> {
    const payment = await prismaBilling.payment.update({
      where: { id: options.paymentId },
      data: {
        receiptUrl: options.receiptUrl,
        notes: options.notes,
      },
    });
    return mapPaymentEntity(payment);
  }

  /** Mengambil pembayaran berdasarkan id beserta invoice. */
  async findByIdWithInvoice(id: string): Promise<PaymentEntity | null> {
    const payment = await prismaBilling.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });
    return payment ? mapPaymentEntity(payment) : null;
  }

  /** Mengambil pembayaran beserta invoice untuk route admin. */
  async findPaginatedWithInvoice(options: {
    where: Prisma.PaymentWhereInput;
    page: number;
    limit: number;
  }): Promise<{ data: PaymentEntity[]; total: number }> {
    const skip = (options.page - 1) * options.limit;
    const [data, total] = await Promise.all([
      prismaBilling.payment.findMany({
        where: options.where,
        include: { invoice: true },
        orderBy: { paymentDate: "desc" },
        skip,
        take: options.limit,
      }),
      prismaBilling.payment.count({ where: options.where }),
    ]);

    return { data: data.map(mapPaymentEntity), total };
  }

  /** Menghitung pembayaran berdasarkan filter. */
  async count(where: Prisma.PaymentWhereInput) {
    return prismaBilling.payment.count({ where });
  }

  /** Membuat pembayaran baru. */
  async create(
    data: Prisma.PaymentUncheckedCreateInput,
  ): Promise<PaymentEntity> {
    const payment = await prismaBilling.payment.create({ data });
    return mapPaymentEntity(payment);
  }

  /** Membuat pembayaran baru beserta invoice untuk route admin. */
  async createWithInvoice(
    data: Prisma.PaymentUncheckedCreateInput,
  ): Promise<PaymentEntity> {
    const payment = await prismaBilling.payment.create({
      data,
      include: { invoice: true },
    });
    return mapPaymentEntity(payment);
  }

  /** Memperbarui banyak pembayaran dalam transaksi caller. */
  async updateManyInTransaction(
    tx: typeof prismaBilling,
    where: Prisma.PaymentWhereInput,
    data: Prisma.PaymentUpdateManyArgs["data"],
  ) {
    return tx.payment.updateMany({ where, data });
  }

  /** Membuat pembayaran customer untuk beberapa invoice dalam satu transaksi. */
  async createCustomerPaymentsForInvoices(options: {
    customerId: string;
    tenantId?: string | null;
    invoiceIds: string[];
    discountAmount: number;
    paymentMethod: string;
    notes?: string | null;
    couponId?: string | null;
    couponService?: CustomerPaymentCouponService;
  }) {
    return prismaBilling.$transaction(async (tx) => {
      const discountPerInvoice =
        options.discountAmount > 0
          ? Math.floor(options.discountAmount / options.invoiceIds.length)
          : 0;
      const payments = [];

      for (let index = 0; index < options.invoiceIds.length; index++) {
        const invoiceId = options.invoiceIds[index];
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
        });
        if (!invoice) {
          continue;
        }

        const currentDiscount =
          index === options.invoiceIds.length - 1 && options.discountAmount > 0
            ? options.discountAmount -
              discountPerInvoice * (options.invoiceIds.length - 1)
            : discountPerInvoice;
        const payment = await tx.payment.create({
          data: {
            id: randomUUID(),
            updatedAt: new Date(),
            amount: Number(invoice.totalAmount) - currentDiscount,
            paymentDate: new Date(),
            paymentMethod: resolveCustomerPaymentMethod(options.paymentMethod),
            gatewayStatus: GatewayPaymentStatus.PENDING,
            accountId: resolveManualAccountId(options.paymentMethod),
            reference: `PAY-${randomUUID()}`,
            notes: options.notes,
            pelangganId: options.customerId,
            invoiceId,
            tenantId: options.tenantId || undefined,
          },
        });

        payments.push(payment);
      }

      if (options.couponId && options.couponService) {
        await options.couponService.recordUsage(
          options.couponId,
          options.customerId,
          tx,
        );
        await options.couponService.incrementUsage(options.couponId, tx);
      }

      return payments.map(mapPaymentEntity);
    });
  }

  /** Memperbarui metadata gateway untuk pembayaran customer. */
  async updateGatewayMetadata(options: {
    paymentIds: string[];
    tenantId?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | null;
    gatewayProvider?: string | null;
  }) {
    return prismaBilling.payment.updateMany({
      where: {
        id: { in: options.paymentIds },
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      },
      data: {
        transactionId: options.transactionId,
        paymentUrl: options.paymentUrl,
        expiresAt: options.expiresAt,
        gatewayProvider: options.gatewayProvider,
      },
    });
  }

  /** Mengambil pembayaran pertama dengan client auth untuk webhook. */
  async findFirstAuth(
    where: Prisma.PaymentWhereInput,
  ): Promise<Payment | null> {
    return prismaBillingAuth.payment.findFirst({ where });
  }
}

function mapPaymentEntity(payment: Record<string, unknown>) {
  return payment as unknown as PaymentEntity;
}

function resolveCustomerPaymentMethod(paymentMethod: string) {
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

function resolveManualAccountId(paymentMethod: string) {
  return paymentMethod.startsWith("MANUAL_")
    ? paymentMethod.replace("MANUAL_", "")
    : null;
}
