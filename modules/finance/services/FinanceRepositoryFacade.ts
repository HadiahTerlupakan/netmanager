import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { UnmatchedMutationRepository } from "../repositories/UnmatchedMutationRepository";

/**
 * Facade untuk akses repositories finance dari module lain.
 * Menyediakan factory methods untuk dependency injection.
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
}
