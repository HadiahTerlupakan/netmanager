import { describe, expect, it, vi } from "vitest";

const finance = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/modules/finance", () => ({
  FinanceRepositoryFacade: {
    createInvoiceRepository: () => ({ findMany: finance.findMany }),
  },
}));

import { AppError } from "@/lib/errors";
import {
  ResellerReportService,
  toPeriodRange,
} from "@/modules/reseller/services/ResellerReportService";
import {
  buildResellerReportCsv,
  buildResellerReportFilename,
} from "@/modules/reseller/services/reseller-report-csv";
import { FinanceResellerBillingReader } from "@/modules/reseller/services/finance-billing-reader";
import { resellerReportQuerySchema } from "@/modules/reseller/validators/reseller-commission";
import type {
  IResellerBillingReader,
  IResellerReportRepository,
} from "@/modules/reseller/domain/ports/IResellerReportSources";

function createRepository(): IResellerReportRepository {
  return {
    findReseller: vi
      .fn()
      .mockResolvedValue({ id: "reseller-1", code: "RS01", name: "Mitra" }),
    findOutlets: vi.fn().mockResolvedValue([
      { id: "outlet-a", code: "A", name: "Outlet A" },
      { id: "outlet-b", code: "B", name: "Outlet B" },
    ]),
    findCustomers: vi.fn().mockResolvedValue([
      { id: "c1", outletId: "outlet-a", isActive: true },
      { id: "c2", outletId: "outlet-a", isActive: false },
      { id: "c3", outletId: null, isActive: true },
    ]),
    sumCommissions: vi.fn().mockResolvedValue([
      { pelangganId: "c1", status: "PAID", amount: 10000 },
      { pelangganId: "c2", status: "SETTLED", amount: 5000 },
      { pelangganId: "c3", status: "ACCRUED", amount: 2000 },
      // Pelanggan sudah pindah dari reseller ini: tetap dihitung di "Langsung".
      { pelangganId: "moved", status: "ACCRUED", amount: 1000 },
      // Sudah dibayar lalu ditagih balik: tetap tercatat disettle & dibayar.
      { pelangganId: "c2", status: "REVERSED", amount: 4000 },
    ]),
    sumAdjustments: vi.fn().mockResolvedValue([
      { pelangganId: "c2", amount: 4000 },
      { pelangganId: "moved", amount: 700 },
    ]),
  };
}

const billing: IResellerBillingReader = {
  summarizeInvoices: vi.fn().mockResolvedValue([
    { pelangganId: "c1", grossBilled: 111000, paid: 111000 },
    { pelangganId: "c3", grossBilled: 50000, paid: 0 },
  ]),
};

describe("ResellerReportService", () => {
  it("merinci angka per outlet dan menjumlahkan total", async () => {
    const repository = createRepository();
    const report = await new ResellerReportService(
      repository,
      billing,
    ).getMonthlyReport("tenant-1", "reseller-1", "2026-10");

    expect(repository.sumCommissions).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
      "2026-10",
    );
    expect(repository.sumAdjustments).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      periodStart: new Date("2026-10-01T00:00:00.000Z"),
      periodEnd: new Date("2026-10-31T23:59:59.999Z"),
    });
    expect(billing.summarizeInvoices).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      pelangganIds: ["c1", "c2", "c3"],
      periodStart: new Date("2026-10-01T00:00:00.000Z"),
      periodEnd: new Date("2026-10-31T23:59:59.999Z"),
    });
    expect(report.rows).toEqual([
      {
        outletId: null,
        outletCode: null,
        outletName: "Langsung (tanpa outlet)",
        activeCustomers: 1,
        grossBilled: 50000,
        paid: 0,
        commissionAccrued: 3000,
        commissionSettled: 0,
        commissionPaid: 0,
        commissionAdjusted: 700,
      },
      {
        outletId: "outlet-a",
        outletCode: "A",
        outletName: "Outlet A",
        activeCustomers: 1,
        grossBilled: 111000,
        paid: 111000,
        commissionAccrued: 19000,
        commissionSettled: 19000,
        commissionPaid: 14000,
        commissionAdjusted: 4000,
      },
      expect.objectContaining({ outletId: "outlet-b", grossBilled: 0 }),
    ]);
    expect(report.totals).toEqual({
      activeCustomers: 2,
      grossBilled: 161000,
      paid: 111000,
      commissionAccrued: 22000,
      commissionSettled: 19000,
      commissionPaid: 14000,
      commissionAdjusted: 4700,
    });
  });

  it("tidak membaca tagihan bila reseller belum punya pelanggan", async () => {
    const repository = createRepository();
    vi.mocked(repository.findCustomers).mockResolvedValueOnce([]);
    vi.mocked(repository.sumCommissions).mockResolvedValueOnce([]);
    vi.mocked(repository.sumAdjustments).mockResolvedValueOnce([]);
    const emptyBilling = { summarizeInvoices: vi.fn() };

    const report = await new ResellerReportService(
      repository,
      emptyBilling,
    ).getMonthlyReport("tenant-1", "reseller-1", "2026-10");

    expect(emptyBilling.summarizeInvoices).not.toHaveBeenCalled();
    expect(report.rows.map((row) => row.outletId)).toEqual([
      "outlet-a",
      "outlet-b",
    ]);
  });

  it("menjawab 404 untuk reseller tenant lain", async () => {
    const repository = createRepository();
    vi.mocked(repository.findReseller).mockResolvedValueOnce(null);

    const error = await new ResellerReportService(repository, billing)
      .getMonthlyReport("tenant-1", "reseller-x", "2026-10")
      .catch((caught: unknown) => caught);

    expect((error as AppError).statusCode).toBe(404);
  });

  it("rentang periode memakai bulan UTC penuh", () => {
    expect(toPeriodRange("2026-12")).toEqual({
      periodStart: new Date("2026-12-01T00:00:00.000Z"),
      periodEnd: new Date("2026-12-31T23:59:59.999Z"),
    });
  });
});

describe("CSV laporan reseller", () => {
  const report = {
    resellerId: "reseller-1",
    resellerCode: "RS/01",
    resellerName: "Mitra",
    period: "2026-10",
    rows: [
      {
        outletId: "o1",
        outletCode: "A",
        outletName: '=HYPERLINK("x"), Outlet',
        activeCustomers: 1,
        grossBilled: 111000,
        paid: 111000,
        commissionAccrued: 10000,
        commissionSettled: 10000,
        commissionPaid: 0,
        commissionAdjusted: 2500,
      },
    ],
    totals: {
      activeCustomers: 1,
      grossBilled: 111000,
      paid: 111000,
      commissionAccrued: 10000,
      commissionSettled: 10000,
      commissionPaid: 0,
      commissionAdjusted: 2500,
    },
  };

  it("menulis header, baris outlet, dan TOTAL dengan sel aman dari rumus", () => {
    const lines = buildResellerReportCsv(report).split("\n");

    expect(lines[0]).toBe(
      "Outlet,Kode outlet,Pelanggan aktif,Tagihan bruto (incl. PPN),Terbayar,Komisi terbit,Komisi disettle,Komisi dibayar,Koreksi",
    );
    expect(lines[1]).toBe(
      `"'=HYPERLINK(""x""), Outlet",A,1,111000,111000,10000,10000,0,2500`,
    );
    expect(lines[2]).toBe("TOTAL,,1,111000,111000,10000,10000,0,2500");
  });

  it("menamai berkas dengan kode reseller yang aman untuk header", () => {
    expect(buildResellerReportFilename(report)).toBe(
      "laporan-reseller-RS_01-2026-10.csv",
    );
  });
});

describe("resellerReportQuerySchema", () => {
  it.each([["2026-13"], ["2026-1"], ["oktober"], [undefined]])(
    "menolak periode %s",
    (period) => {
      expect(resellerReportQuerySchema.safeParse({ period }).success).toBe(
        false,
      );
    },
  );

  it("default format json", () => {
    expect(resellerReportQuerySchema.parse({ period: "2026-10" })).toEqual({
      period: "2026-10",
      format: "json",
    });
  });
});

describe("FinanceResellerBillingReader", () => {
  const range = {
    periodStart: new Date("2026-10-01T00:00:00.000Z"),
    periodEnd: new Date("2026-10-31T23:59:59.999Z"),
  };

  it("menjumlah tagihan terbit dan pelunasan di periode, bertenant", async () => {
    finance.findMany.mockResolvedValueOnce([
      {
        pelangganId: "c1",
        status: "PAID",
        totalAmount: 111000n,
        issueDate: new Date("2026-10-02T00:00:00.000Z"),
        paidAt: new Date("2026-10-05T00:00:00.000Z"),
      },
      // Terbit bulan lalu, lunas bulan ini: hanya terhitung terbayar.
      {
        pelangganId: "c1",
        status: "PAID",
        totalAmount: 100000n,
        issueDate: new Date("2026-09-25T00:00:00.000Z"),
        paidAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      // Dibatalkan: tidak dihitung sebagai tagihan.
      {
        pelangganId: "c2",
        status: "CANCELLED",
        totalAmount: 50000n,
        issueDate: new Date("2026-10-03T00:00:00.000Z"),
        paidAt: null,
      },
      {
        pelangganId: "c2",
        status: "SENT",
        totalAmount: 70000n,
        issueDate: new Date("2026-10-04T00:00:00.000Z"),
        paidAt: null,
      },
    ]);

    const totals = await new FinanceResellerBillingReader().summarizeInvoices({
      tenantId: "tenant-1",
      pelangganIds: ["c1", "c2"],
      ...range,
    });

    expect(finance.findMany.mock.calls[0][0]).toMatchObject({
      tenantId: "tenant-1",
      pelangganId: { in: ["c1", "c2"] },
    });
    expect(totals).toEqual([
      { pelangganId: "c1", grossBilled: 111000, paid: 211000 },
      { pelangganId: "c2", grossBilled: 70000, paid: 0 },
    ]);
  });
});
