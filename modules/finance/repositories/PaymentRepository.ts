import { prismaBilling } from "@/modules/database";
import { type Prisma } from "@prisma/client-billing";
import type { IPaymentRepository } from "../domain/ports/IPaymentRepository";
import type { PaymentEntity } from "../domain/entities/PaymentEntity";
import {
  attachReceiptToPayments,
  cancelPendingManualPayments,
  createCustomerPaymentsForInvoices,
  findFirstAuthPayment,
  findLatestPendingCustomerPayment,
  findPendingManualCheckout,
  mapPaymentEntity,
  markCustomerCheckoutFailed,
} from "./paymentRepository.customer-payments";

export class PaymentRepository implements IPaymentRepository {
  /**
   * Pembayaran yang uangnya benar-benar diterima dalam rentang tanggal:
   * lunas lewat gateway/verifikasi (PAID), atau dicatat langsung tanpa status
   * gateway (mis. pembayaran registrasi). Checkout yang menunggu, kedaluwarsa,
   * gagal, atau dibatalkan dulu ikut terjumlah, sehingga setiap ganti metode
   * bayar menambah "pendapatan".
   */
  async findReceivedByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentEntity[]> {
    const payments = await prismaBilling.payment.findMany({
      where: {
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
        OR: [{ gatewayStatus: "PAID" }, { gatewayStatus: null }],
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

  /**
   * Payment transfer manual yang menunggu verifikasi dari checkout yang
   * memuat invoice ini, seluruh invoice-nya.
   */
  async findPendingManualCheckout(options: {
    invoiceId: string;
    pelangganId: string;
  }) {
    return findPendingManualCheckout(options);
  }

  /** Melampirkan bukti transfer ke payment checkout yang masih menunggu. */
  async attachReceipt(options: {
    receiptUrl: string;
    payments: Array<{ id: string; notes: string }>;
  }): Promise<number> {
    return attachReceiptToPayments(options);
  }

  /** Payment menunggu terbaru milik pelanggan untuk invoice ini. */
  async findLatestPending(options: { invoiceId: string; pelangganId: string }) {
    return findLatestPendingCustomerPayment(options);
  }

  /** Menutup payment transfer manual yang belum diverifikasi. */
  async cancelPendingManual(paymentIds: string[]): Promise<number> {
    return cancelPendingManualPayments(paymentIds);
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
    couponUsageId?: string | null;
    couponId?: string | null;
  }) {
    return createCustomerPaymentsForInvoices(options);
  }

  /** Memperbarui metadata gateway untuk pembayaran customer. */
  async updateGatewayMetadata(options: {
    paymentIds: string[];
    tenantId?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    vaNumber?: string | null;
    qrString?: string | null;
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
        vaNumber: options.vaNumber,
        qrString: options.qrString,
        expiresAt: options.expiresAt,
        gatewayProvider: options.gatewayProvider,
      },
    });
  }

  /** Marks checkout payments as FAILED with the gateway's rejection text. */
  async markAsFailed(paymentIds: string[], failureReason: string) {
    return markCustomerCheckoutFailed(paymentIds, failureReason);
  }

  /** Mengambil pembayaran pertama dengan client auth untuk webhook. */
  async findFirstAuth(where: Prisma.PaymentWhereInput) {
    return findFirstAuthPayment(where);
  }

  /** Memperbarui pembayaran berdasarkan id. */
  async updatePaymentById(paymentId: string, data: Prisma.PaymentUpdateInput) {
    return prismaBilling.payment.update({ where: { id: paymentId }, data });
  }
}
