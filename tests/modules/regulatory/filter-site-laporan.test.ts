import { describe, expect, it, vi } from "vitest";

import { SelfAssessmentReportService } from "@/modules/regulatory";

/**
 * Izin penyelenggaraan bisa mencakup sebagian wilayah saja, jadi laporan harus
 * bisa dibatasi ke site tertentu.
 *
 * Yang dijaga ketat: `undefined` berarti seluruh site, sedangkan array kosong
 * berarti tidak ada site sama sekali. Menukar keduanya membuat pilihan "tidak
 * ada site" justru melaporkan seluruh tenant ke regulator.
 */

const buatService = () => {
  const listWorkOrders = vi.fn().mockResolvedValue([]);
  const service = new SelfAssessmentReportService(
    { listWorkOrders } as never,
    { listHolidayDates: vi.fn().mockResolvedValue([]) } as never,
    { listSites: vi.fn().mockResolvedValue([]) } as never,
  );
  return { service, listWorkOrders };
};

const siteIdsPadaPanggilan = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls[0][0].siteIds;

describe("penyaring site pada laporan", () => {
  it("tanpa pilihan site, seluruh site tenant ikut", async () => {
    const { service, listWorkOrders } = buatService();

    await service.build(2025, "tenant-1", "JARTAPLOK_PS");

    expect(siteIdsPadaPanggilan(listWorkOrders)).toBeUndefined();
  });

  it("meneruskan site yang dipilih apa adanya", async () => {
    const { service, listWorkOrders } = buatService();

    await service.build(2025, "tenant-1", "JARTAPLOK_PS", ["site-a", "site-b"]);

    expect(siteIdsPadaPanggilan(listWorkOrders)).toEqual(["site-a", "site-b"]);
  });

  // Regresi: array kosong tidak boleh berubah menjadi "tanpa batas".
  it("daftar site kosong tetap kosong, bukan seluruh tenant", async () => {
    const { service, listWorkOrders } = buatService();

    await service.build(2025, "tenant-1", "JARTAPLOK_PS", []);

    expect(siteIdsPadaPanggilan(listWorkOrders)).toEqual([]);
    expect(siteIdsPadaPanggilan(listWorkOrders)).not.toBeUndefined();
  });

  it("berlaku sama untuk kedua jenis izin", async () => {
    for (const skema of ["JARTAPLOK_PS", "ISP"] as const) {
      const { service, listWorkOrders } = buatService();

      await service.build(2025, "tenant-1", skema, ["site-a"]);

      expect(siteIdsPadaPanggilan(listWorkOrders)).toEqual(["site-a"]);
    }
  });
});
