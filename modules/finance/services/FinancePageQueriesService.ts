import type { IUnpaidBillsReadRepository } from "../domain/ports/IUnpaidBillsReadRepository";
import { createUnpaidBillsReadRepository } from "../factories/FinancePageQueriesFactory";

export class FinancePageQueriesService {
  constructor(
    private readonly repository: IUnpaidBillsReadRepository = createUnpaidBillsReadRepository(),
  ) {}

  async getUnpaidBillsPageData() {
    return this.repository.findUnpaidBillsPageData();
  }
}
