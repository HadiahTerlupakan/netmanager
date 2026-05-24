import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type MRRMovementType =
  | "NEW"
  | "EXPANSION"
  | "CONTRACTION"
  | "CHURN"
  | "REACTIVATION";

export interface RecordMovementInput {
  movementType: MRRMovementType;
  pelangganId?: string | null;
  amount: bigint;
  description?: string | null;
  tenantId?: string | null;
  occurredAt?: Date;
}

export interface MRRMovementSummary {
  month: number;
  year: number;
  movementType: MRRMovementType;
  totalAmount: bigint;
  count: number;
}

/**
 * Tulis MRR movement ke database.
 *
 * Movement types:
 * - NEW: pelanggan baru aktivasi pertama (positif)
 * - EXPANSION: upgrade paket harga lebih tinggi (positif, delta saja)
 * - CONTRACTION: downgrade paket harga lebih rendah (negatif, delta saja)
 * - CHURN: pelanggan berhenti/suspended/deleted (negatif, current MRR)
 * - REACTIVATION: pelanggan churn aktif lagi (positif)
 */
export class MRRMovementService {
  async recordMovement(input: RecordMovementInput): Promise<void> {
    const occurredAt = input.occurredAt ?? new Date();

    try {
      await prisma.mRRMovement.create({
        data: {
          id: globalThis.crypto.randomUUID(),
          movementType: input.movementType,
          pelangganId: input.pelangganId ?? null,
          amount: input.amount,
          description: input.description ?? null,
          month: occurredAt.getMonth() + 1,
          year: occurredAt.getFullYear(),
          tenantId: input.tenantId ?? null,
        },
      });
    } catch (error) {
      logger.error(
        `[MRRMovement] Failed to record ${input.movementType} for ${input.pelangganId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Aggregat per bulan untuk dashboard executive.
   * Dipakai oleh RevenueSnapshot daily cron.
   */
  async getMonthSummary(
    year: number,
    month: number,
    tenantId?: string | null,
  ): Promise<MRRMovementSummary[]> {
    const grouped = await prisma.mRRMovement.groupBy({
      by: ["movementType"],
      where: {
        year,
        month,
        ...(tenantId !== undefined ? { tenantId } : {}),
      },
      _sum: { amount: true },
      _count: true,
    });

    return grouped.map((row) => ({
      month,
      year,
      movementType: row.movementType as MRRMovementType,
      totalAmount: row._sum.amount ?? 0n,
      count: row._count,
    }));
  }

  /** Ambil current MRR pelanggan dari paket aktifnya. */
  async getCurrentCustomerMRR(pelangganId: string): Promise<bigint> {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        hargaPaket: { select: { harga: true } },
      },
    });

    return pelanggan ? BigInt(pelanggan.hargaPaket.harga) : 0n;
  }
}

let instance: MRRMovementService | null = null;

export function getMRRMovementService(): MRRMovementService {
  instance ??= new MRRMovementService();
  return instance;
}
