import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResellerPricingService } from "@/modules/reseller/services/ResellerPricingService";
import type { IResellerRepository } from "@/modules/reseller/domain/ports/IResellerRepository";

function createRepository(): IResellerRepository {
  return {
    findByCode: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findOutletById: vi.fn(),
    findOutletByCode: vi.fn(),
    findOutletsByResellerId: vi.fn(),
    createOutlet: vi.fn(),
    updateOutlet: vi.fn(),
    softDeleteOutlet: vi.fn(),
    findActivePackagePrice: vi.fn(),
    findBasePackagePrice: vi.fn(),
    findPackagePricesByResellerId: vi.fn(),
    upsertPackagePrice: vi.fn(),
  };
}

describe("ResellerPricingService", () => {
  let repository: IResellerRepository;
  let service: ResellerPricingService;

  beforeEach(() => {
    repository = createRepository();
    service = new ResellerPricingService(repository);
  });

  it("resolves active reseller package price override", async () => {
    vi.mocked(repository.findActivePackagePrice).mockResolvedValueOnce({
      id: "price-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
      price: 180000,
      status: "ACTIVE",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    const result = await service.resolvePackagePrice({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
      at: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result).toEqual({
      price: 180000,
      source: "RESELLER_OVERRIDE",
      priceId: "price-1",
    });
    expect(repository.findBasePackagePrice).not.toHaveBeenCalled();
  });

  it("falls back to base package price when override is missing", async () => {
    vi.mocked(repository.findActivePackagePrice).mockResolvedValueOnce(null);
    vi.mocked(repository.findBasePackagePrice).mockResolvedValueOnce(150000);

    const result = await service.resolvePackagePrice({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
      at: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result).toEqual({
      price: 150000,
      source: "BASE_PACKAGE",
      priceId: null,
    });
  });

  it("falls back to base package price when reseller id is absent", async () => {
    vi.mocked(repository.findBasePackagePrice).mockResolvedValueOnce(150000);

    const result = await service.resolvePackagePrice({
      tenantId: "tenant-1",
      resellerId: null,
      hargaPaketId: "package-1",
      at: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result).toEqual({
      price: 150000,
      source: "BASE_PACKAGE",
      priceId: null,
    });
    expect(repository.findActivePackagePrice).not.toHaveBeenCalled();
  });
});
