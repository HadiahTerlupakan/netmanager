import type {
  ITaxTransactionRepository,
  TaxTransactionListFilter,
  TaxTransactionListResult,
} from "../domain/ports/ITaxTransactionRepository";

export class TaxTransactionService {
  constructor(private readonly txnRepo: ITaxTransactionRepository) {}

  /** List tax transactions with pagination and filters. */
  async list(
    filter: TaxTransactionListFilter,
  ): Promise<TaxTransactionListResult> {
    return this.txnRepo.list(filter);
  }
}
