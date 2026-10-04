/** Sumber data laporan dari modul lain; diimplementasikan lewat API publik modul tersebut. */

export type ServiceLevelWorkOrderType = "INSTALLATION" | "TROUBLESHOOT";

export interface ServiceLevelWorkOrder {
  workOrderNumber: string;
  type: ServiceLevelWorkOrderType;
  siteId: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
}

export interface WorkOrderSource {
  listWorkOrders(query: {
    tenantId: string;
    types: ServiceLevelWorkOrderType[];
    from: Date;
    to: Date;
  }): Promise<ServiceLevelWorkOrder[]>;
}

export interface HolidaySource {
  listHolidayDates(years: number[], tenantId: string): Promise<Date[]>;
}

export interface ReportSite {
  id: string;
  name: string;
  kabupatenKota: string | null;
}

export interface SiteSource {
  listSites(): Promise<ReportSite[]>;
}
