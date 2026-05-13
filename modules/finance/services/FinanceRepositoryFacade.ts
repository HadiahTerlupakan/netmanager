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
}
