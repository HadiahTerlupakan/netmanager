import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import { prisma } from "@/modules/database";

/** Konstanta dan tipe pendukung. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PRORATE_INVOICE_DUE_DAYS = 7;
const PROVIDER_REFUND_METHOD = "OTHER" as const;

export type ProrateOption = "NONE" | "PRORATE_CHARGE" | "PRORATE_CREDIT";
export type DowngradeAdjustment = "NONE" | "REFUND" | "CREDIT";
export type UpgradeApplyTime = "IMMEDIATE" | "NEXT_CYCLE";

export type InvoiceProrateErrorCode =
  | "PELANGGAN_NOT_FOUND"
  | "PACKAGE_NOT_FOUND";

export class InvoiceProrateError extends Error {
  constructor(
    message: string,
    public readonly code: InvoiceProrateErrorCode,
  ) {
    super(message);
    this.name = "InvoiceProrateError";
  }
}

export interface ApplyPackageChangeInput {
  pelangganId: string;
  oldHargaPaketId: string;
  newHargaPaketId: string;
  prorateOption: ProrateOption;
  downgradeAdjustment: DowngradeAdjustment;
  upgradeApplyTime: UpgradeApplyTime;
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
 * Hitung jumlah pro-rata berdasarkan absolute price diff dan window hari.
 * Pure function — mudah di-test tanpa I/O.
 */
export function calculateProratedAmount(
  absoluteDiff: bigint,
  sisaHari: number,
  totalHari: number,
): bigint {
  if (totalHari <= 0 || sisaHari <= 0 || absoluteDiff <= 0n) return 0n;
  return (absoluteDiff * BigInt(sisaHari)) / BigInt(totalHari);
}

type PelangganProrateContext = {
  id: string;
  jatuhTempo: Date;
  tanggalAktif: Date;
  hargaPaketId: string;
  tenantId: string | null;
};

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
    const pelanggan = await this.fetchPelangganContext(input.pelangganId);
    const { oldPackage, newPackage } = await this.fetchPackagePair(
      input.oldHargaPaketId,
      input.newHargaPaketId,
    );

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
    pelanggan: PelangganProrateContext,
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
      amount: 0n,
      sisaHari,
      totalHari,
      tenantId: pelanggan.tenantId,
    });

    logger.info(
      `[InvoiceProrateService] NEXT_CYCLE scheduled for ${input.pelangganId} at ${pelanggan.jatuhTempo.toISOString()}`,
    );

    return {
      applied: false,
      prorateAmount: 0n,
      scheduledFor: pelanggan.jatuhTempo,
    };
  }

  /**
   * IMMEDIATE: hitung prorate sesuai prorateOption dan downgradeAdjustment,
   * buat invoice/credit/refund sesuai kebutuhan.
   */
  private async handleImmediate(
    input: ApplyPackageChangeInput,
    pelanggan: PelangganProrateContext,
    oldPackage: { harga: number },
    newPackage: { harga: number },
    sisaHari: number,
    totalHari: number,
  ): Promise<ApplyPackageChangeResult> {
    const priceDiff = BigInt(newPackage.harga) - BigInt(oldPackage.harga);
    const isUpgrade = priceDiff > 0n;
    const isDowngrade = priceDiff < 0n;

    let prorateAmount = 0n;
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
    const charge = calculateProratedAmount(
      params.priceDiff,
      params.sisaHari,
      params.totalHari,
    );

    if (charge <= 0n) return { charge: 0n };

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
    const credit = calculateProratedAmount(
      -params.priceDiff,
      params.sisaHari,
      params.totalHari,
    );

    if (credit <= 0n) return { creditAmount: 0n };

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
    return { creditAmount: 0n };
  }

  /** Fetch pelanggan context atau lempar InvoiceProrateError typed. */
  private async fetchPelangganContext(
    pelangganId: string,
  ): Promise<PelangganProrateContext> {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        id: true,
        jatuhTempo: true,
        tanggalAktif: true,
        hargaPaketId: true,
        tenantId: true,
      },
    });

    if (!pelanggan) {
      throw new InvoiceProrateError(
        `Pelanggan ${pelangganId} tidak ditemukan`,
        "PELANGGAN_NOT_FOUND",
      );
    }
    return pelanggan;
  }

  /** Fetch paket lama dan baru paralel; lempar error kalau salah satu tidak ada. */
  private async fetchPackagePair(
    oldId: string,
    newId: string,
  ): Promise<{
    oldPackage: { id: string; harga: number };
    newPackage: { id: string; harga: number };
  }> {
    const [oldPackage, newPackage] = await Promise.all([
      prisma.hargaPaket.findUnique({
        where: { id: oldId },
        select: { id: true, harga: true },
      }),
      prisma.hargaPaket.findUnique({
        where: { id: newId },
        select: { id: true, harga: true },
      }),
    ]);

    if (!oldPackage || !newPackage) {
      throw new InvoiceProrateError(
        "Paket lama atau baru tidak ditemukan",
        "PACKAGE_NOT_FOUND",
      );
    }
    return { oldPackage, newPackage };
  }

  /** Hitung sisaHari (jatuhTempo - today) dan totalHari (jatuhTempo - tanggalAktif). */
  private calculateDaysRemaining(
    tanggalAktif: Date,
    jatuhTempo: Date,
  ): { sisaHari: number; totalHari: number } {
    const now = new Date();
    const totalHari = Math.max(
      1,
      Math.ceil((jatuhTempo.getTime() - tanggalAktif.getTime()) / MS_PER_DAY),
    );
    const sisaHari = Math.max(
      0,
      Math.ceil((jatuhTempo.getTime() - now.getTime()) / MS_PER_DAY),
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
        dueDate: new Date(Date.now() + PRORATE_INVOICE_DUE_DAYS * MS_PER_DAY),
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
        paymentMethod: PROVIDER_REFUND_METHOD,
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
