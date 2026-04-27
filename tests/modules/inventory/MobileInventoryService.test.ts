import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileInventoryService } from "@/modules/inventory";

const mockRepository = () => ({
  findMobileActorUser: vi.fn(),
  findMobileActorMitra: vi.fn(),
  findMobileGudangs: vi.fn(),
  findMobileBarangForMasuk: vi.fn(),
  findMobileBarangForKeluar: vi.fn(),
  findMobileGudangSites: vi.fn(),
  findMobileBarangGudangStock: vi.fn(),
  findMobileHistoryMasuk: vi.fn(),
  findMobileHistoryKeluar: vi.fn(),
  addStock: vi.fn(),
  removeStock: vi.fn(),
  getStockLevel: vi.fn(),
});

describe("MobileInventoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengambil daftar gudang mobile dengan filter site actor terbatas", async () => {
    const repository = mockRepository();
    repository.findMobileActorUser.mockResolvedValue(null);
    repository.findMobileActorMitra.mockResolvedValue({
      id: "mitra-1",
      siteId: "site-1",
    });
    repository.findMobileGudangs.mockResolvedValue([
      { id: "g-1", kode: "G-1", nama: "Gudang 1", lokasi: "Site 1" },
    ]);
    const service = new MobileInventoryService(repository);

    const result = await service.getGudangs({
      actorId: "mitra-1",
      tenantId: "tenant-1",
    });

    expect(result).toEqual([
      { id: "g-1", kode: "G-1", nama: "Gudang 1", lokasi: "Site 1" },
    ]);
    expect(repository.findMobileGudangs).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      siteIds: ["site-1"],
    });
  });
});
