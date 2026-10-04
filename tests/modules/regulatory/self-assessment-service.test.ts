import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import type { ServiceLevelWorkOrder } from "@/modules/regulatory/domain/ports/self-assessment-sources";
import {
  REGION_NOT_FILLED,
  REGION_WITHOUT_SITE,
  SelfAssessmentReportService,
} from "@/modules/regulatory/services/SelfAssessmentReportService";
import { buildSelfAssessmentWorkbook } from "@/modules/regulatory/services/SelfAssessmentWorkbook";
import { toSelfAssessmentSummary } from "@/modules/regulatory/dto/self-assessment.dto";

const wib = (value: string) => new Date(`${value}+07:00`);

function workOrder(overrides: Partial<ServiceLevelWorkOrder>): ServiceLevelWorkOrder {
  return {
    workOrderNumber: "WO-1",
    type: "INSTALLATION",
    siteId: "site-bogor",
    createdAt: wib("2026-03-02T09:00:00"),
    approvedAt: null,
    completedAt: wib("2026-03-05T15:00:00"),
    ...overrides,
  };
}

function buildService(workOrders: ServiceLevelWorkOrder[], holidays: Date[] = []) {
  const workOrderSource = { listWorkOrders: vi.fn().mockResolvedValue(workOrders) };
  const holidaySource = { listHolidayDates: vi.fn().mockResolvedValue(holidays) };
  const siteSource = {
    listSites: vi.fn().mockResolvedValue([
      { id: "site-bogor", name: "CARIU", kabupatenKota: "Kabupaten Bogor" },
      { id: "site-subang", name: "SUBANG", kabupatenKota: null },
    ]),
  };
  const service = new SelfAssessmentReportService(
    workOrderSource,
    holidaySource,
    siteSource,
    () => wib("2026-10-04T12:00:00"),
  );
  return { service, workOrderSource, holidaySource };
}

describe("SelfAssessmentReportService", () => {
  it("mengambil work order setahun (WIB) dan hari libur tahun itu + berikutnya", async () => {
    const { service, workOrderSource, holidaySource } = buildService([]);

    await service.build(2026, "tenant-1");

    expect(workOrderSource.listWorkOrders).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      types: ["INSTALLATION", "TROUBLESHOOT"],
      from: new Date("2025-12-31T17:00:00Z"),
      to: new Date("2026-12-31T17:00:00Z"),
    });
    expect(holidaySource.listHolidayDates).toHaveBeenCalledWith([2026, 2027], "tenant-1");
  });

  it("pasang baru dihitung sejak disetujui; tanpa waktu persetujuan memakai waktu dibuat", async () => {
    const { service } = buildService([
      workOrder({ workOrderNumber: "WO-A", approvedAt: wib("2026-03-04T08:00:00") }),
      workOrder({ workOrderNumber: "WO-B" }),
    ]);

    const report = await service.build(2026, "tenant-1");
    const [pasangBaru] = report.parameters;

    expect(pasangBaru.samples.map((sample) => [sample.reference, sample.durationDays])).toEqual([
      ["WO-A", 1],
      ["WO-B", 3],
    ]);
    expect(pasangBaru.annual).toMatchObject({ received: 2, met: 2, ratio: 1 });
    expect(pasangBaru.isTargetMet).toBe(true);
  });

  it("pemulihan memakai hari kerja dan hari libur tenant", async () => {
    const { service } = buildService(
      [
        workOrder({
          type: "TROUBLESHOOT",
          createdAt: wib("2026-03-19T09:00:00"), // Kamis
          completedAt: wib("2026-03-23T10:00:00"), // Senin
        }),
      ],
      [wib("2026-03-20T00:00:00")], // Jumat libur
    );

    const [, pemulihan] = (await service.build(2026, "tenant-1")).parameters;

    expect(pemulihan.samples[0]).toMatchObject({ durationDays: 1, outcome: "MET" });
  });

  it("wilayah dari kabupaten/kota site; site tanpa wilayah diperingatkan", async () => {
    const { service } = buildService([
      workOrder({ workOrderNumber: "WO-1" }),
      workOrder({ workOrderNumber: "WO-2", siteId: "site-subang" }),
      workOrder({ workOrderNumber: "WO-3", siteId: null }),
    ]);

    const report = await service.build(2026, "tenant-1");

    expect(report.parameters[0].regions.map((region) => region.region).sort()).toEqual(
      [REGION_WITHOUT_SITE, REGION_NOT_FILLED, "Kabupaten Bogor"].sort(),
    );
    expect(report.warnings.sitesWithoutRegion).toEqual(["SUBANG"]);
  });

  it("ringkasan halaman hanya membawa permohonan tidak memenuhi, terbaru dulu", async () => {
    const { service } = buildService([
      workOrder({ workOrderNumber: "WO-LAMA", completedAt: wib("2026-03-20T10:00:00") }),
      workOrder({ workOrderNumber: "WO-OK" }),
      workOrder({ workOrderNumber: "WO-BARU", createdAt: wib("2026-04-01T09:00:00"), completedAt: null }),
    ]);

    const summary = toSelfAssessmentSummary(await service.build(2026, "tenant-1"));

    expect(summary.parameters[0].notMetCount).toBe(2);
    expect(summary.parameters[0].notMetPreview.map((sample) => sample.reference)).toEqual([
      "WO-BARU",
      "WO-LAMA",
    ]);
  });
});

describe("berkas Excel", () => {
  it("berisi Lampiran I, Agregasi, Catatan dengan baris CAPAIAN", async () => {
    const { service } = buildService([workOrder({})]);
    const buffer = await buildSelfAssessmentWorkbook(await service.build(2026, "tenant-1"));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(buffer).buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Lampiran I", "Agregasi", "Catatan"]);

    const texts: string[] = [];
    workbook.getWorksheet("Lampiran I")!.eachRow((row) => texts.push(String(row.getCell(2).value ?? "")));
    expect(texts.some((text) => text === "WO-1")).toBe(true);
    expect(texts.some((text) => text.includes("= (1 ÷ 1) × 100% = 100,00% → MEMENUHI STANDAR"))).toBe(true);
  });
});
