import { PurchaseOrderRepository } from "../repositories";

type PurchaseOrderRepo = Pick<PurchaseOrderRepository, "findManyWithTax">;

export class FinanceReportService {
  constructor(
    private readonly purchaseOrderRepo: PurchaseOrderRepo = new PurchaseOrderRepository(),
  ) {}

  /** Get reports for finance dashboard. */
  async getReports(type: "CAPEX_OPEX" | "TAX") {
    if (type !== "TAX") return null;

    const startDate = new Date(new Date().getFullYear(), 0, 1);
    const pos = await this.purchaseOrderRepo.findManyWithTax({
      ppnAmount: { gt: 0 },
      createdAt: { gte: startDate },
    });

    return {
      totalPPN: pos.reduce((sum: number, po) => sum + Number(po.ppnAmount), 0),
      details: pos,
    };
  }
}
