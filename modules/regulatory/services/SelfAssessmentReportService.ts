import {
  aggregateByMonth,
  aggregateByQuarter,
  aggregateByRegion,
  combinePeriods,
  isTargetMet,
} from "../domain/service-level-aggregation";
import { evaluateSample } from "../domain/service-level-evaluation";
import {
  SERVICE_LEVEL_PARAMETER_KEYS,
  SERVICE_LEVEL_PARAMETERS,
  type ServiceLevelParameter,
  type ServiceLevelParameterKey,
} from "../domain/service-level-standards";
import type {
  ParameterReport,
  SelfAssessmentReport,
  ServiceLevelSample,
} from "../domain/self-assessment-report";
import { SELF_ASSESSMENT_NOTES, UNAVAILABLE_PARAMETERS } from "../domain/unavailable-parameters";
import { toWibDateKey, wibMonth, wibYearRange } from "../domain/wib-calendar";
import type {
  HolidaySource,
  ReportSite,
  ServiceLevelWorkOrder,
  ServiceLevelWorkOrderType,
  SiteSource,
  WorkOrderSource,
} from "../domain/ports/self-assessment-sources";
import {
  HolidayDirectory,
  ServiceLevelWorkOrders,
  SiteDirectory,
} from "./self-assessment-source-adapters";

/**
 * Penyusun laporan Self-Assessment Komdigi untuk parameter yang datanya sudah
 * ada di sistem (pasang baru & pemulihan layanan dari work order).
 */

const WORK_ORDER_TYPE: Record<ServiceLevelParameterKey, ServiceLevelWorkOrderType> = {
  PASANG_BARU: "INSTALLATION",
  PEMULIHAN_LAYANAN: "TROUBLESHOOT",
};

export const REGION_NOT_FILLED = "(Kabupaten/kota belum diisi)";
export const REGION_WITHOUT_SITE = "(Tanpa site)";

interface BuildContext {
  now: Date;
  holidayKeys: ReadonlySet<string>;
  siteById: Map<string, ReportSite>;
}

/** Awal hitungan durasi: pasang baru sejak disetujui, pemulihan sejak diajukan. */
function startOf(parameter: ServiceLevelParameter, workOrder: ServiceLevelWorkOrder): Date {
  return parameter.key === "PASANG_BARU"
    ? (workOrder.approvedAt ?? workOrder.createdAt)
    : workOrder.createdAt;
}

function regionOf(site: ReportSite | undefined): string {
  if (!site) return REGION_WITHOUT_SITE;
  return site.kabupatenKota?.trim() || REGION_NOT_FILLED;
}

export class SelfAssessmentReportService {
  constructor(
    private readonly workOrders: WorkOrderSource = new ServiceLevelWorkOrders(),
    private readonly holidays: HolidaySource = new HolidayDirectory(),
    private readonly sites: SiteSource = new SiteDirectory(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Laporan satu tahun (WIB) untuk tenant tersebut. */
  async build(year: number, tenantId: string): Promise<SelfAssessmentReport> {
    const range = wibYearRange(year);
    const [workOrders, holidayDates, sites] = await Promise.all([
      this.workOrders.listWorkOrders({
        tenantId,
        types: Object.values(WORK_ORDER_TYPE),
        from: range.from,
        to: range.to,
      }),
      // Tahun berikutnya ikut: permohonan akhir Desember bisa selesai di Januari.
      this.holidays.listHolidayDates([year, year + 1], tenantId),
      this.sites.listSites(),
    ]);

    const context: BuildContext = {
      now: this.clock(),
      holidayKeys: new Set(holidayDates.map(toWibDateKey)),
      siteById: new Map(sites.map((site) => [site.id, site])),
    };
    const parameters = SERVICE_LEVEL_PARAMETER_KEYS.map((key) =>
      this.buildParameter(
        SERVICE_LEVEL_PARAMETERS[key],
        workOrders.filter((workOrder) => workOrder.type === WORK_ORDER_TYPE[key]),
        context,
      ),
    );

    return {
      year,
      generatedAt: context.now,
      parameters,
      unavailable: UNAVAILABLE_PARAMETERS,
      notes: SELF_ASSESSMENT_NOTES,
      warnings: {
        sitesWithoutRegion: this.sitesWithoutRegion(workOrders, context.siteById),
        lastHolidayDate: this.lastHolidayInYear(holidayDates, year),
      },
    };
  }

  private buildParameter(
    parameter: ServiceLevelParameter,
    workOrders: ServiceLevelWorkOrder[],
    context: BuildContext,
  ): ParameterReport {
    const samples = workOrders.map((workOrder) => this.toSample(parameter, workOrder, context));
    const aggregatable = samples.map((sample) => ({
      month: wibMonth(sample.startedAt),
      region: sample.region,
      outcome: sample.outcome,
    }));
    const months = aggregateByMonth(aggregatable);
    const annual = combinePeriods(months);

    return {
      parameter,
      samples,
      months,
      quarters: aggregateByQuarter(months),
      annual,
      regions: aggregateByRegion(aggregatable),
      pendingCount: samples.filter((sample) => sample.outcome === "PENDING").length,
      isTargetMet: isTargetMet(annual, parameter.targetRatio),
    };
  }

  private toSample(
    parameter: ServiceLevelParameter,
    workOrder: ServiceLevelWorkOrder,
    context: BuildContext,
  ): ServiceLevelSample {
    const startedAt = startOf(parameter, workOrder);
    const site = workOrder.siteId ? context.siteById.get(workOrder.siteId) : undefined;
    const evaluation = evaluateSample(
      parameter,
      { startedAt, finishedAt: workOrder.completedAt },
      { now: context.now, holidayKeys: context.holidayKeys },
    );

    return {
      reference: workOrder.workOrderNumber,
      submittedAt: workOrder.createdAt,
      startedAt,
      finishedAt: workOrder.completedAt,
      durationDays: evaluation.durationDays,
      outcome: evaluation.outcome,
      siteName: site?.name ?? null,
      region: regionOf(site),
    };
  }

  private sitesWithoutRegion(
    workOrders: ServiceLevelWorkOrder[],
    siteById: Map<string, ReportSite>,
  ): string[] {
    const names = workOrders
      .map((workOrder) => (workOrder.siteId ? siteById.get(workOrder.siteId) : undefined))
      .filter((site): site is ReportSite => Boolean(site) && !site?.kabupatenKota?.trim())
      .map((site) => site.name);
    return [...new Set(names)].sort((left, right) => left.localeCompare(right));
  }

  private lastHolidayInYear(holidayDates: Date[], year: number): Date | null {
    const inYear = holidayDates.filter((date) => toWibDateKey(date).startsWith(`${year}-`));
    return inYear.length
      ? new Date(Math.max(...inYear.map((date) => date.getTime())))
      : null;
  }
}
