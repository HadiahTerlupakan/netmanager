import { describe, expect, it, vi } from "vitest";
import type { IPelangganRepository } from "@/modules/pelanggan/domain/ports/IPelangganRepository";
import { CustomerPackageService } from "@/modules/pelanggan/services/CustomerPackageService";

const CURRENT_PACKAGE_PRICE = 150_000;
const CUSTOMER_SITE_ID = "site-jakarta";

function buildCustomerWithPackage() {
  return {
    id: "cust-1",
    siteId: CUSTOMER_SITE_ID,
    tanggalAktif: new Date("2026-01-01"),
    jatuhTempo: new Date("2026-10-01"),
    status: "AKTIF",
    hargaPaket: {
      id: "pkg-1",
      name: "Paket Basic 10 Mbps",
      harga: CURRENT_PACKAGE_PRICE,
      durasi: 30,
      durasiUnit: "HARI",
      usePPN: false,
      ppnPercentage: null as number | null,
      useDiscount: false,
      discountType: null as string | null,
      discountValue: null as number | null,
      featured: false,
      bandwidth: null as { name: string } | null,
    },
  };
}

function buildRepositoryStub(
  findUpgradePackageOptions: ReturnType<typeof vi.fn>,
) {
  return {
    findByIdWithPackage: vi.fn().mockResolvedValue(buildCustomerWithPackage()),
    findUpgradePackageOptions,
  } as unknown as IPelangganRepository;
}

describe("CustomerPackageService.getCustomerPackage", () => {
  it("scopes upgrade options to the customer's site", async () => {
    const findUpgradePackageOptions = vi.fn().mockResolvedValue([]);
    const service = new CustomerPackageService(
      buildRepositoryStub(findUpgradePackageOptions),
    );

    await service.getCustomerPackage("cust-1");

    expect(findUpgradePackageOptions).toHaveBeenCalledWith(
      CURRENT_PACKAGE_PRICE,
      expect.any(Number),
      CUSTOMER_SITE_ID,
    );
  });

  it("exposes price difference for each upgrade option", async () => {
    const findUpgradePackageOptions = vi.fn().mockResolvedValue([
      {
        id: "pkg-2",
        name: "Paket Standard 20 Mbps",
        harga: 250_000,
        durasi: 30,
        durasiUnit: "HARI",
        featured: true,
        bandwidth: {
          name: "20 Mbps",
          maxLimitDownload: "20M",
          maxLimitUpload: "5M",
        },
      },
    ]);
    const service = new CustomerPackageService(
      buildRepositoryStub(findUpgradePackageOptions),
    );

    const result = await service.getCustomerPackage("cust-1");

    expect(result.upgradeOptions).toEqual([
      {
        id: "pkg-2",
        nama: "Paket Standard 20 Mbps",
        harga: 250_000,
        durasi: 30,
        durasiUnit: "HARI",
        isFeatured: true,
        priceDifference: 100_000,
        bandwidth: { nama: "20 Mbps", download: "20M", upload: "5M" },
      },
    ]);
  });
});
