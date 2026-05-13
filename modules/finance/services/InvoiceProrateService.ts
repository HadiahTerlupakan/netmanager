import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import { prisma } from "@/modules/database";

export interface ApplyPackageChangeInput {
  pelangganId: string;
  oldHargaPaketId: string;
  newHargaPaketId: string;
  prorateOption: "NONE" | "PRORATE_CHARGE" | "PRORATE_CREDIT";
  downgradeAdjustment: "NONE" | "REFUND" | "CREDIT";
  upgradeApplyTime: "IMMEDIATE" | "NEXT_CYCLE";
  userId?: string;
}

export interface ApplyPackageChangeResult {
  /** true = paket sudah berubah di DB; false = scheduled (NEXT_CYCLE) */
  applied: boolean;
  /** + untuk charge, - untuk credit, 0 untuk none */
  prorateAmount: bigint;
  prorateInvoiceId?: string;
  creditApplied?: bigint;
  refundPaymentId?: string;
  scheduledFor?: Date;
}

/**
 * Handle prorate calculation dan side-effects saat paket pelanggan berubah.
 * Support 3 skenario: NONE, PRORATE_CHARGE (upgrade), PRORATE_CREDIT (downgrade).
 * Untuk NEXT_CYCLE: revert hargaPaketId dan set pendingPackage fields.
 */
export class InvoiceProrateService {
  /** Entry point utama — dispatch ke branch NEXT_CYCLE atau IMMEDIATE. */
  async applyPackageChange(
    input: ApplyPackageChangeInput,
  ): Promise<ApplyPackageChangeResult> {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: input.pelangganId },
      select: {
        id: true,
        jatuhTempo: true,
        tanggalAktif: true,
        hargaPaketId: true,
        tenantId: true,
      },
    });

    if (!pelanggan) {
      throw new Error(`Pelanggan ${input.pelangganId} tidak ditemukan`);
    }

    const [oldPackage, newPackage] = await Promise.all([
      prisma.hargaPaket.findUnique({
        where: { id: input.oldHargaPaketId },
        select: { id: true, harga: true },
      }),
      prisma.hargaPaket.findUnique({
        where: { id: input.newHargaPaketId },
        select: { id: true, harga: true },
      }),
    ]);

    if (!oldPackage || !newPackage) {
      throw new Error("Paket lama atau baru tidak ditemukan");
    }

    const { sisaHari, totalHari } = this.calculateDaysRemaining(
      pelanggan.tanggalAktif,
      pelanggan.jatuhTempo,
    );

    if (input.upgradeApplyTime === "NEXT_CYCLE") {
      return this.handleNextCycle(input, pelanggan, sisaHari, totalHari);
    }

    return this.handleImmediate(
      input,
      pelanggan,
      oldPackage,
      newPackage,
      sisaHari,
      totalHari,
    );
  }

  /**
   * NEXT_CYCLE: set pendingPackage, revert hargaPaketId ke lama.
   * Cron PendingPackageApplierService yang akan apply saat jatuhTempo.
   */
  private async handleNextCycle(
    input: ApplyPackageChangeInput,
    pelanggan: { id: string; jatuhTempo: Date; tenantId: string | null },
    sisaHari: number,
    totalHari: number,
  ): Promise<ApplyPackageChangeResult> {
    await prisma.pelanggan.update({
      where: { id: input.pelangganId },
      data: {
        hargaPaketId: input.oldHargaPaketId, // revert — scheduled change
        pendingPackageId: input.newHargaPaketId,
        pendingPackageApplyAt: pelanggan.jatuhTempo,
      },
    });

    await this.logProrateActivity({
      input,
      amount: BigInt(0),
      sisaHari,
      totalHari,
      tenantId: pelanggan.tenantId,
    });

    logger.info(
      `[InvoiceProrateService] NEXT_CYCLE scheduled for ${input.pelangganId} at ${pelanggan.jatuhTempo.toISOString()}`,
    );

    return {
      applied: false,
      prorateAmount: BigInt(0),
      scheduledFor: pelanggan.jatuhTempo,
    };
  }

  /**
   * IMMEDIATE: hitung prorate sesuai prorateOption dan downgradeAdjustment,
   * buat invoice/credit/refund sesuai kebutuhan.
   */
  private async handleImmediate(
    input: ApplyPackageChangeInput,
    pelanggan: { id: string; tenantId: string | null },
    oldPackage: { harga: number },
    newPackage: { harga: number },
    sisaHari: number,
    totalHari: number,
  ): Promise<ApplyPackageChangeResult> {
    const priceDiff = BigInt(newPackage.harga) - BigInt(oldPackage.harga);
    const isUpgrade = priceDiff > BigInt(0);
    const isDowngrade = priceDiff < BigInt(0);

    let prorateAmount = BigInt(0);
    let prorateInvoiceId: string | undefined;
    let creditApplied: bigint | undefined;
    let refundPaymentId: string | undefined;

    if (input.prorateOption === "PRORATE_CHARGE" && isUpgrade) {
      const result = await this.applyProrateCharge({
        input,
        pelanggan,
        priceDiff,
        sisaHari,
        totalHari,
      });
      prorateAmount = result.charge;
      prorateInvoiceId = result.invoiceId;
    } else if (input.prorateOption === "PRORATE_CREDIT" && isDowngrade) {
      const result = await this.applyProrateCredit({
        input,
        pelanggan,
        priceDiff,
        sisaHari,
        totalHari,
      });
      prorateAmount = result.creditAmount;
      creditApplied = result.creditApplied;
      refundPaymentId = result.refundPaymentId;
    }
    // NONE atau tidak ada selisih → tidak ada aksi prorate

    await this.logProrateActivity({
      input,
      amount: prorateAmount,
      sisaHari,
      totalHari,
      tenantId: pelanggan.tenantId,
    });

    return {
      applied: true,
      prorateAmount,
      prorateInvoiceId,
      creditApplied,
      refundPaymentId,
    };
  }

  /** Buat invoice prorate untuk upgrade (charge selisih pro-rata). */
  private async applyProrateCharge(params: {
    input: ApplyPackageChangeInput;
    pelanggan: { id: string; tenantId: string | null };
    priceDiff: bigint;
    sisaHari: number;
    totalHari: number;
  }): Promise<{ charge: bigint; invoiceId?: string }> {
    const charge =
      (params.priceDiff * BigInt(params.sisaHari)) / BigInt(params.totalHari);

    if (charge <= BigInt(0)) {
      return { charge: BigInt(0) };
    }

    const invoiceId = await this.createProrateInvoice({
      pelangganId: params.pelanggan.id,
      amount: charge,
      tenantId: params.pelanggan.tenantId,
      description: `Prorate upgrade paket (${params.sisaHari} dari ${params.totalHari} hari)`,
    });

    return { charge, invoiceId };
  }

  /** Apply kredit atau refund untuk downgrade (credit selisih pro-rata). */
  private async applyProrateCredit(params: {
    input: ApplyPackageChangeInput;
    pelanggan: { id: string; tenantId: string | null };
    priceDiff: bigint;
    sisaHari: number;
    totalHari: number;
  }): Promise<{
    creditAmount: bigint;
    creditApplied?: bigint;
    refundPaymentId?: string;
  }> {
    // priceDiff negatif untuk downgrade → ambil nilai absolut
    const credit =
      (-params.priceDiff * BigInt(params.sisaHari)) / BigInt(params.totalHari);

    if (credit <= BigInt(0)) {
      return { creditAmount: BigInt(0) };
    }

    if (params.input.downgradeAdjustment === "CREDIT") {
      await prisma.pelanggan.update({
        where: { id: params.pelanggan.id },
        data: { saldoKreditRupiah: { increment: credit } },
      });
      logger.info(
        `[InvoiceProrateService] Credit ${credit} applied to saldo for ${params.pelanggan.id}`,
      );
      return { creditAmount: -credit, creditApplied: credit };
    }

    if (params.input.downgradeAdjustment === "REFUND") {
      const refundPaymentId = await this.createRefundPayment({
        pelangganId: params.pelanggan.id,
        amount: credit,
        tenantId: params.pelanggan.tenantId,
      });
      return { creditAmount: -credit, refundPaymentId };
    }

    // NONE — log saja, tidak apply
    return { creditAmount: BigInt(0) };
  }

  /** Hitung sisaHari (jatuhTempo - today) dan totalHari (jatuhTempo - tanggalAktif). */
  private calculateDaysRemaining(
    tanggalAktif: Date,
    jatuhTempo: Date,
  ): { sisaHari: number; totalHari: number } {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalHari = Math.max(
      1,
      Math.ceil((jatuhTempo.getTime() - tanggalAktif.getTime()) / msPerDay),
    );
    const sisaHari = Math.max(
      0,
      Math.ceil((jatuhTempo.getTime() - now.getTime()) / msPerDay),
    );
    return { sisaHari, totalHari };
  }

  /** Buat invoice prorate dengan status SENT, due 7 hari. */
  private async createProrateInvoice(params: {
    pelangganId: string;
    amount: bigint;
    tenantId: string | null;
    description: string;
  }): Promise<string> {
    const invoiceNumber = `PRORATE/${Date.now()}/${params.pelangganId.slice(-6)}`;
    const invoice = await prismaBilling.invoice.create({
      data: {
        id: crypto.randomUUID(),
        invoiceNumber,
        pelangganId: params.pelangganId,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "SENT",
        subtotal: params.amount,
        totalAmount: params.amount,
        notes: params.description,
        tenantId: params.tenantId,
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[InvoiceProrateService] Created prorate invoice ${invoiceNumber} amount=${params.amount}`,
    );
    return invoice.id;
  }

  /** Buat payment record negatif sebagai refund pending (admin proses manual). */
  private async createRefundPayment(params: {
    pelangganId: string;
    amount: bigint;
    tenantId: string | null;
  }): Promise<string> {
    const payment = await prismaBilling.payment.create({
      data: {
        id: crypto.randomUUID(),
        pelangganId: params.pelangganId,
        amount: -params.amount, // negatif = refund
        paymentDate: new Date(),
        paymentMethod: "OTHER",
        gatewayStatus: "PENDING",
        notes: "Refund pending admin approval (downgrade prorate)",
        tenantId: params.tenantId,
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[InvoiceProrateService] Created refund payment pending amount=${params.amount} for ${params.pelangganId}`,
    );
    return payment.id;
  }

  /** Log semua aktivitas prorate ke ProratePaymentLog. */
  private async logProrateActivity(params: {
    input: ApplyPackageChangeInput;
    amount: bigint;
    sisaHari: number;
    totalHari: number;
    tenantId: string | null;
  }) {
    await prisma.proratePaymentLog.create({
      data: {
        id: crypto.randomUUID(),
        pelangganId: params.input.pelangganId,
        oldPackageId: params.input.oldHargaPaketId,
        newPackageId: params.input.newHargaPaketId,
        prorateOption: params.input.prorateOption,
        downgradeAdjustment: params.input.downgradeAdjustment,
        upgradeApplyTime: params.input.upgradeApplyTime,
        amount: params.amount,
        sisaHari: params.sisaHari,
        totalHari: params.totalHari,
        createdBy: params.input.userId ?? null,
        tenantId: params.tenantId,
      },
    });
  }
}
