import { describe, expect, it, vi } from "vitest";

const hasilPerProyek = vi.hoisted(() => [
  { totalBagiHasil: 1_000.1, totalPengembalianModal: 2_500.45, persenBerlaku: 50 },
  { totalBagiHasil: 2_000.2, totalPengembalianModal: 499.55, persenBerlaku: 50 },
]);

vi.mock("@/modules/investor/services/investor-project-tracking.helpers", () => {
  let panggilan = 0;
  return {
    // Dua panggilan per proyek (proyeksi & total), urut per proyek.
    hitungHasilInvestorProyek: vi.fn(() => hasilPerProyek[Math.floor(panggilan++ / 2) % 2]),
  };
});

import { buildDashboardResponse } from "@/modules/investor/services/investor-portal-dashboard.helpers";

function proyek(id: string) {
  return {
    investmentAmount: 1_000_000n,
    rabProject: {
      id,
      name: `Proyek ${id}`,
      status: "PENJUALAN",
      site: null as { name: string } | null,
      projectedRevenue: 0n,
      projectedOpex: 0n,
      contingencyAmount: 0n,
    },
  };
}

const TANPA_PELANGGAN = { total: 0, active: 0, paying: 0, paymentRatio: 0 };

describe("buildDashboardResponse — pembulatan total ke sen", () => {
  it("total bagi hasil & pengembalian modal mengikuti pembulatan sen record tersimpan (bukan floor)", () => {
    const hasil = buildDashboardResponse([proyek("a"), proyek("b")] as never, TANPA_PELANGGAN);

    // 1000.1 + 2000.2 = 3000.3000000000002 di floating point → dibulatkan ke sen.
    expect(hasil.totalActualRevenue).toBe("3000.3");
    // 2500.45 + 499.55 = 3000 → tidak terpotong menjadi 2999.
    expect(hasil.totalCapitalReturned).toBe("3000");
    expect(hasil.totalInvestment).toBe("2000000");
  });
});
