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
    /**
     * Batasi ke site tertentu. `undefined` berarti seluruh site tenant —
     * dibedakan dari array kosong, yang berarti tidak ada site sama sekali
     * dan karenanya laporan kosong.
     */
    siteIds?: string[];
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

/**
 * Keluhan pelanggan sebagai sumber parameter non-jaringan ISP.
 *
 * Formulir ISP menuntut tiga angka berbasis keluhan (akurasi tagihan, keluhan
 * umum yang diselesaikan, tingkat laporan gangguan) dengan penyebut berbeda-
 * beda: jumlah tagihan, jumlah keluhan diterima, dan jumlah pelanggan. Port ini
 * mengembalikan cacahnya apa adanya; rumus dan agregasinya milik domain.
 */
export type TicketCategoryKey = "TECHNICAL" | "BILLING" | "ACCOUNT" | "OTHER";

export interface TicketCounts {
  /** Keluhan yang diterima pada periode. */
  received: number;
  /** Dari `received`, yang sudah berstatus selesai. */
  resolved: number;
  /** Dari `resolved`, yang selesai dalam batas waktu yang diminta parameter. */
  resolvedWithinLimit: number;
}

export interface TicketSource {
  countTickets(query: {
    tenantId: string;
    categories: TicketCategoryKey[];
    from: Date;
    to: Date;
    /** Batas waktu penyelesaian; tanpa ini `resolvedWithinLimit` sama dengan `resolved`. */
    limit?: {
      maxDays: number;
      dayUnit: "CALENDAR" | "WORKING";
      holidays: Date[];
    };
    /** Batasi ke site pelanggan tertentu; `undefined` = seluruh site tenant. */
    siteIds?: string[];
  }): Promise<TicketCounts>;
}

/** Penyebut parameter keluhan: jumlah tagihan dan jumlah pelanggan pada periode. */
export interface BillingVolumeSource {
  countInvoices(query: {
    tenantId: string;
    from: Date;
    to: Date;
    siteIds?: string[];
  }): Promise<number>;
  countCustomers(query: {
    tenantId: string;
    asOf: Date;
    siteIds?: string[];
  }): Promise<number>;
}
