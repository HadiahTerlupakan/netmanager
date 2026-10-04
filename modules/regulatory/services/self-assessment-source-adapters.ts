import { HolidayLookupService } from "@/modules/attendance";
import { SiteService } from "@/modules/roles";
import { WorkOrderServiceLevelQueryService } from "@/modules/work-order";
import type {
  HolidaySource,
  ReportSite,
  ServiceLevelWorkOrder,
  SiteSource,
  WorkOrderSource,
} from "../domain/ports/self-assessment-sources";

/** Adaptor sumber data laporan ke API publik modul work-order, attendance, dan roles. */

export class ServiceLevelWorkOrders implements WorkOrderSource {
  constructor(private readonly query = new WorkOrderServiceLevelQueryService()) {}

  async listWorkOrders(query: Parameters<WorkOrderSource["listWorkOrders"]>[0]): Promise<ServiceLevelWorkOrder[]> {
    const records = await this.query.listForServiceLevel(query);
    return records.map((record) => ({
      workOrderNumber: record.workOrderNumber,
      type: record.type as ServiceLevelWorkOrder["type"],
      siteId: record.siteId,
      createdAt: record.createdAt,
      approvedAt: record.approvedAt,
      completedAt: record.completedAt,
    }));
  }
}

export class HolidayDirectory implements HolidaySource {
  constructor(private readonly holidays = new HolidayLookupService()) {}

  listHolidayDates(years: number[], tenantId: string): Promise<Date[]> {
    return this.holidays.listHolidayDates(years, tenantId);
  }
}

export class SiteDirectory implements SiteSource {
  constructor(private readonly sites = new SiteService()) {}

  /** Semua site tenant (termasuk nonaktif — work order lama tetap butuh wilayahnya). */
  async listSites(): Promise<ReportSite[]> {
    const result = await this.sites.getSites();
    if (!result.success) throw new Error(result.error ?? "Gagal memuat site");
    return result.data.map((site) => ({
      id: site.id,
      name: site.name,
      kabupatenKota: site.kabupatenKota,
    }));
  }
}
