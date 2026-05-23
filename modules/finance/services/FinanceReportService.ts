import {
  getPurchaseOrderRepository,
  type IPurchaseOrderRepository,
} from "@/modules/procurement";

type PurchaseOrderRepo = Pick<IPurchaseOrderRepository, "findManyWithTax">;

export class FinanceReportService {
  constructor(
    private readonly purchaseOrderRepo: PurchaseOrderRepo = getPurchaseOrderRepository(),
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
