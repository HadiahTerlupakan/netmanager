import { prisma } from "@/modules/database";
import { logger } from "@/lib/logger";
import { consumeSaldoKreditAtomic } from "../repositories/SaldoKreditRepository";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { UnmatchedMutationRepository } from "../repositories/UnmatchedMutationRepository";

/**
 * Facade untuk akses repositories finance dari module lain.
 * Menyediakan factory methods untuk dependency injection dan operasi
 * yang sering dipakai cross-module supaya consumer tidak perlu
 * mengetahui tipe repository internal.
 */
export class FinanceRepositoryFacade {
  static createInvoiceRepository(): InvoiceRepository {
    return new InvoiceRepository();
  }

  static createPaymentRepository(): PaymentRepository {
    return new PaymentRepository();
  }

  static createUnmatchedMutationRepository(): UnmatchedMutationRepository {
    return new UnmatchedMutationRepository();
  }

  /**
   * Hitung invoice unpaid (status SENT/OVERDUE) untuk satu pelanggan.
   * Dipakai oleh handler INVOICE_PAID di module pelanggan untuk activation guard.
   */
  static async countUnpaidInvoicesForPelanggan(
    pelangganId: string,
  ): Promise<number> {
    return new InvoiceRepository().countUnpaidByPelangganId(pelangganId);
  }

  /**
   * Konsumsi saldo kredit pelanggan secara atomic (SELECT FOR UPDATE).
   * Return jumlah yang berhasil dikonsumsi (0n jika tidak ada saldo).
   */
  static async consumeSaldoKredit(
    pelangganId: string,
    capAmount: bigint,
  ): Promise<bigint> {
    if (capAmount <= 0n) return 0n;

    const applied = await consumeSaldoKreditAtomic(pelangganId, capAmount);

    if (applied > 0n) {
      logger.info(
        `[FinanceRepositoryFacade] Konsumsi saldo kredit ${applied} untuk pelanggan ${pelangganId}`,
      );
    }
    return applied;
  }

  /**
   * Kembalikan saldo kredit pelanggan (compensating action).
   * Fire-and-forget — log error tapi tidak throw.
   */
  static async refundSaldoKredit(
    pelangganId: string,
    amount: bigint,
  ): Promise<void> {
    await prisma.pelanggan
      .update({
        where: { id: pelangganId },
        data: { saldoKreditRupiah: { increment: amount } },
      })
      .catch((err) =>
        logger.error(
          `[FinanceRepositoryFacade] Gagal kompensasi saldo kredit ${amount} untuk ${pelangganId}`,
          err instanceof Error ? err : undefined,
        ),
      );
  }
}
