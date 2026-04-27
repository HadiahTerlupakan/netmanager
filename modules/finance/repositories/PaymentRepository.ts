import { prismaBilling, prismaBillingAuth } from "@/lib/prisma-billing";
import type { Prisma, Payment } from "@prisma/client-billing";

export class PaymentRepository {
  /** Mengambil pembayaran dalam rentang tanggal pembayaran. */
  async findManyByDateRange(startDate: Date, endDate: Date) {
    return prismaBilling.payment.findMany({
      where: {
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
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

  /** Menghitung pembayaran berdasarkan filter. */
  async count(where: Prisma.PaymentWhereInput) {
    return prismaBilling.payment.count({ where });
  }

  /** Membuat pembayaran baru. */
  async create(data: Prisma.PaymentUncheckedCreateInput) {
    return prismaBilling.payment.create({ data });
  }

  /** Memperbarui banyak pembayaran dalam transaksi caller. */
  async updateManyInTransaction(
    tx: typeof prismaBilling,
    where: Prisma.PaymentWhereInput,
    data: Prisma.PaymentUpdateManyArgs["data"],
  ) {
    return tx.payment.updateMany({ where, data });
  }

  /** Mengambil pembayaran pertama dengan client auth untuk webhook. */
  async findFirstAuth(
    where: Prisma.PaymentWhereInput,
  ): Promise<Payment | null> {
    return prismaBillingAuth.payment.findFirst({ where });
  }
}
