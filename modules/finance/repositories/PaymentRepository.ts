import { prismaBilling } from "@/modules/database";
import { type Prisma } from "@prisma/client-billing";
import type { IPaymentRepository } from "../domain/ports/IPaymentRepository";
import type { PaymentEntity } from "../domain/entities/PaymentEntity";
import {
  countInvestorPayouts,
  createCustomerPaymentsForInvoices,
  createInvestorPayout,
  findFirstAuthPayment,
  findInvestorById,
  findInvestorDetail,
  findManyInvestorPayouts,
  mapPaymentEntity,
} from "./paymentRepository.customer-payments";

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
    couponService?: {
      recordUsage(
        couponId: string,
        customerId: string,
        tx: unknown,
      ): Promise<unknown>;
      incrementUsage(couponId: string, tx: unknown): Promise<unknown>;
    };
  }) {
    return createCustomerPaymentsForInvoices(options);
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
  async findFirstAuth(where: Prisma.PaymentWhereInput) {
    return findFirstAuthPayment(where);
  }

  /** Memperbarui pembayaran berdasarkan id. */
  async updatePaymentById(paymentId: string, data: Prisma.PaymentUpdateInput) {
    return prismaBilling.payment.update({ where: { id: paymentId }, data });
  }

  /** Mengambil daftar payout investor dengan pagination. */
  async findManyInvestorPayouts(options: {
    investorId: string;
    skip: number;
    take: number;
  }) {
    return findManyInvestorPayouts(options);
  }

  /** Menghitung total payout investor. */
  async countInvestorPayouts(investorId: string) {
    return countInvestorPayouts(investorId);
  }

  /** Mengambil investor sederhana berdasarkan id. */
  async findInvestorById(investorId: string) {
    return findInvestorById(investorId);
  }

  /** Membuat payout investor baru. */
  async createInvestorPayout(data: {
    investorId: string;
    amount: bigint;
    date: Date;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    reference?: string;
    notes?: string;
    status: string;
  }) {
    return createInvestorPayout(data);
  }

  /** Mengambil detail investor lengkap untuk admin route. */
  async findInvestorDetail(investorId: string) {
    return findInvestorDetail(investorId);
  }
}
