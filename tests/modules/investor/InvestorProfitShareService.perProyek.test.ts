import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { InvestorProfitShareService } from "@/modules/investor/services/InvestorProfitShareService";

function proyek(ubah: Record<string, unknown> = {}) {
  return {
    id: "rab-1",
    name: "Jaringan Sukamaju",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    projectedOpex: 1_000_000n,
    targetSubscribers: 0,
    arpu: null as bigint | null,
    growthType: "LINEAR",
    paymentType: "PREPAID",
    growthSettings: null as unknown,
    investmentDurationMonths: 12,
    investmentRecoveryType: "PERCENTAGE",
    investmentRecoveryValue: 50,
    investorProfitSharePercent: 50,
    investorProfitShareMode: "FLAT",
    investorProfitShareBeforeBepPercent: 80,
    investorProfitShareAfterBepPercent: 60,
    nplTolerancePercent: 0,
    opexBufferFundingMode: "COMPANY",
    opexBufferInvestorPercent: 0,
    opexBufferInvestorFixedAmount: 0n,
    opexBufferSafetyPercent: 0,
    items: [{ totalPrice: 10_000_000n, expenseType: "CAPEX" }],
    actualAchievements: [
      {
        month: 3,
        actualRevenue: 5_000_000n,
        manualRecoveryInstallment: null as bigint | null,
        manualInvestorShare: null as bigint | null,
        manualCompanyShare: null as bigint | null,
        manualInvestorProfitSharePercent: null as number | null,
      },
    ],
    investors: [
      { investorId: "inv-a", investmentAmount: 6_000_000n, investor: { isActive: true } },
      { investorId: "inv-b", investmentAmount: 4_000_000n, investor: { isActive: true } },
    ],
    ...ubah,
  };
}

const repo = {
  findProjectsForProfitShare: vi.fn(),
  findPaidProjectMonthsByInvestor: vi.fn(),
  create: vi.fn(async (data: Record<string, unknown>) => data),
};
const service = new InvestorProfitShareService(repo as never);
const AGUSTUS = [new Date("2026-08-01T00:00:00.000Z"), new Date("2026-08-31T00:00:00.000Z")] as const;

describe("InvestorProfitShareService.calculateForPeriod — per proyek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findPaidProjectMonthsByInvestor.mockResolvedValue(new Map());
  });

  it("memakai tracking RAB: pengembalian modal + bagi hasil dibagi sesuai porsi modal", async () => {
    repo.findProjectsForProfitShare.mockResolvedValue([proyek()]);

    const hasil = await service.calculateForPeriod("t-1", ...AGUSTUS);

    // Bulan ke-3 (Agu): laba kotor 5jt − opex 1jt = 4jt; pengembalian modal 50% = 2jt;
    // laba bersih 2jt; bagian investor 50% = 1jt. Porsi modal 60% : 40%.
    expect(hasil.dilewati).toEqual([]);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        investorId: "inv-a",
        rabProjectId: "rab-1",
        netProfit: 2_000_000,
        shareAmount: 600_000,
        capitalReturnAmount: 1_200_000,
        sharePercent: 30,
        projectMonths: [3],
        tenantId: "t-1",
      }),
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ investorId: "inv-b", shareAmount: 400_000, capitalReturnAmount: 800_000, sharePercent: 20 }),
    );
    expect(hasil.dibuat).toHaveLength(2);
  });

  it("proyek tanpa tanggal mulai atau tanpa capaian di periode dilewati dengan alasan", async () => {
    repo.findProjectsForProfitShare.mockResolvedValue([
      proyek({ id: "rab-2", name: "Tanpa Tanggal", startDate: null }),
      proyek({ id: "rab-3", name: "Belum Ada Capaian", actualAchievements: [] }),
    ]);

    const hasil = await service.calculateForPeriod("t-1", ...AGUSTUS);

    expect(repo.create).not.toHaveBeenCalled();
    expect(hasil.dilewati).toEqual([
      { rabProjectId: "rab-2", namaProyek: "Tanpa Tanggal", alasan: "Tanggal mulai proyek belum diisi di RAB" },
      { rabProjectId: "rab-3", namaProyek: "Belum Ada Capaian", alasan: "Belum ada capaian bulanan (aktual) di periode ini" },
    ]);
  });

  it("periode tumpang tindih tidak membayar bulan yang sama dua kali", async () => {
    repo.findProjectsForProfitShare.mockResolvedValue([
      proyek({
        actualAchievements: [2, 3].map((month) => ({
          month,
          actualRevenue: 5_000_000n,
          actualOpex: null as bigint | null,
          manualRecoveryInstallment: null as bigint | null,
          manualInvestorShare: null as bigint | null,
          manualCompanyShare: null as bigint | null,
          manualInvestorProfitSharePercent: null as number | null,
        })),
      }),
    ]);
    // Bulan ke-3 (Agustus) sudah dibagikan lewat perhitungan Agustus sebelumnya.
    repo.findPaidProjectMonthsByInvestor.mockResolvedValue(
      new Map([
        ["inv-a", new Set([3])],
        ["inv-b", new Set([3])],
      ]),
    );

    await service.calculateForPeriod("t-1", new Date("2026-07-01T00:00:00.000Z"), new Date("2026-08-31T00:00:00.000Z"));

    for (const [data] of repo.create.mock.calls) {
      expect(data).toMatchObject({ projectMonths: [2] });
    }
  });

  it("aman diulang: investor yang sudah dihitung dan investor nonaktif dilewati", async () => {
    repo.findProjectsForProfitShare.mockResolvedValue([
      proyek({
        investors: [
          { investorId: "inv-a", investmentAmount: 6_000_000n, investor: { isActive: true } },
          { investorId: "inv-b", investmentAmount: 4_000_000n, investor: { isActive: false } },
        ],
      }),
    ]);
    repo.findPaidProjectMonthsByInvestor.mockResolvedValue(new Map([["inv-a", new Set([3])]]));

    const hasil = await service.calculateForPeriod("t-1", ...AGUSTUS);

    expect(repo.create).not.toHaveBeenCalled();
    expect(hasil.dibuat).toEqual([]);
    // Satu query per proyek, hanya untuk investor aktif (bukan per investor).
    expect(repo.findPaidProjectMonthsByInvestor).toHaveBeenCalledTimes(1);
    expect(repo.findPaidProjectMonthsByInvestor).toHaveBeenCalledWith("rab-1", ["inv-a"]);
  });

  it("bulan dibayar dibaca per investor: investor lain tetap dapat bulannya", async () => {
    repo.findProjectsForProfitShare.mockResolvedValue([proyek()]);
    repo.findPaidProjectMonthsByInvestor.mockResolvedValue(new Map([["inv-a", new Set([3])]]));

    await service.calculateForPeriod("t-1", ...AGUSTUS);

    expect(repo.findPaidProjectMonthsByInvestor).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ investorId: "inv-b", projectMonths: [3] }),
    );
  });

  it("kalkulasi bersamaan: bulan yang sudah dibagikan proses lain (P2002) dilewati, investor lain tetap dibuat", async () => {
    repo.findProjectsForProfitShare.mockResolvedValue([proyek()]);
    repo.create
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }))
      .mockImplementationOnce(async (data: Record<string, unknown>) => data);

    const hasil = await service.calculateForPeriod("t-1", ...AGUSTUS);

    expect(hasil.dibuat).toHaveLength(1);
    expect(hasil.dibuat[0]).toMatchObject({ investorId: "inv-b" });
  });

  it("galat selain bentrok unique tetap dilempar", async () => {
    repo.findProjectsForProfitShare.mockResolvedValue([proyek()]);
    repo.create.mockRejectedValueOnce(new Error("koneksi putus"));

    await expect(service.calculateForPeriod("t-1", ...AGUSTUS)).rejects.toThrow("koneksi putus");
  });
});
