import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import { prisma } from "@/modules/database";
import type {
  CreateProrateInvoiceInput,
  CreateRefundPaymentInput,
  IProrateRepository,
  PackageInfo,
  PelangganProrateContext,
  RecordProrateLogInput,
  SchedulePackageChangeInput,
} from "../domain/ports/IProrateRepository";

/**
 * Implementasi default IProrateRepository memakai Prisma main + billing.
 * Service `InvoiceProrateService` depend pada port-nya, bukan class ini —
 * mempermudah test (inject mock) dan migrasi storage di masa depan.
 */
export class ProrateRepository implements IProrateRepository {
  async findPelangganProrateContext(
    pelangganId: string,
  ): Promise<PelangganProrateContext | null> {
    return prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        id: true,
        jatuhTempo: true,
        tanggalAktif: true,
        hargaPaketId: true,
        tenantId: true,
      },
    });
  }

  async findPackagePair(
    oldHargaPaketId: string,
    newHargaPaketId: string,
  ): Promise<{ old: PackageInfo; new: PackageInfo } | null> {
    const [oldPkg, newPkg] = await Promise.all([
      prisma.hargaPaket.findUnique({
        where: { id: oldHargaPaketId },
        select: { id: true, harga: true },
      }),
      prisma.hargaPaket.findUnique({
        where: { id: newHargaPaketId },
        select: { id: true, harga: true },
      }),
    ]);

    if (!oldPkg || !newPkg) return null;
    return { old: oldPkg, new: newPkg };
  }

  async schedulePackageChange(
    input: SchedulePackageChangeInput,
  ): Promise<void> {
    await prisma.pelanggan.update({
      where: { id: input.pelangganId },
      data: {
        hargaPaketId: input.oldHargaPaketId, // revert — scheduled change
        pendingPackageId: input.newHargaPaketId,
        pendingPackageApplyAt: input.applyAt,
      },
    });
  }

  async incrementSaldoKredit(
    pelangganId: string,
    credit: bigint,
  ): Promise<void> {
    await prisma.pelanggan.update({
      where: { id: pelangganId },
      data: { saldoKreditRupiah: { increment: credit } },
    });
  }

  async createProrateInvoice(
    input: CreateProrateInvoiceInput,
  ): Promise<string> {
    const invoiceNumber = `PRORATE/${Date.now()}/${input.pelangganId.slice(-6)}`;
    const invoice = await prismaBilling.invoice.create({
      data: {
        id: crypto.randomUUID(),
        invoiceNumber,
        pelangganId: input.pelangganId,
        issueDate: new Date(),
        dueDate: input.dueAt,
        status: "SENT",
        subtotal: input.amount,
        totalAmount: input.amount,
        notes: input.description,
        tenantId: input.tenantId,
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[ProrateRepository] Created prorate invoice ${invoiceNumber} amount=${input.amount}`,
    );
    return invoice.id;
  }

  async createRefundPaymentRecord(
    input: CreateRefundPaymentInput,
  ): Promise<string> {
    const payment = await prismaBilling.payment.create({
      data: {
        id: crypto.randomUUID(),
        pelangganId: input.pelangganId,
        amount: -input.amount, // negatif = refund
        paymentDate: new Date(),
        paymentMethod: "OTHER",
        gatewayStatus: "PENDING",
        notes: "Refund pending admin approval (downgrade prorate)",
        tenantId: input.tenantId,
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[ProrateRepository] Created refund payment pending amount=${input.amount} for ${input.pelangganId}`,
    );
    return payment.id;
  }

  async recordProrateLog(input: RecordProrateLogInput): Promise<void> {
    await prisma.proratePaymentLog.create({
      data: {
        id: crypto.randomUUID(),
        pelangganId: input.pelangganId,
        oldPackageId: input.oldPackageId,
        newPackageId: input.newPackageId,
        prorateOption: input.prorateOption,
        downgradeAdjustment: input.downgradeAdjustment,
        upgradeApplyTime: input.upgradeApplyTime,
        amount: input.amount,
        sisaHari: input.sisaHari,
        totalHari: input.totalHari,
        createdBy: input.createdBy,
        tenantId: input.tenantId,
      },
    });
  }
}
