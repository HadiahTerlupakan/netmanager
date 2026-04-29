import {
  UnpaidBillsReadRepository,
  type UnpaidBillsReadRepositoryPort,
} from "../repositories/UnpaidBillsReadRepository";

export class FinancePageQueriesService {
  constructor(
    private readonly repository: UnpaidBillsReadRepositoryPort = new UnpaidBillsReadRepository(),
  ) {}

  async getUnpaidBillsPageData() {
    return this.repository.findUnpaidBillsPageData();
  }
}
