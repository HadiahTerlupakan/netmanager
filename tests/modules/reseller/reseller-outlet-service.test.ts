import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResellerOutletService } from "@/modules/reseller/services/ResellerOutletService";
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

describe("ResellerOutletService", () => {
  let repository: IResellerRepository;
  let service: ResellerOutletService;

  beforeEach(() => {
    repository = createRepository();
    service = new ResellerOutletService(repository);
  });

  it("creates outlet under an active reseller in the same tenant", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce({
      id: "reseller-1",
      tenantId: "tenant-1",
      code: "RSL-001",
      name: "Reseller Satu",
      email: null,
      phone: null,
      address: null,
      status: "ACTIVE",
      notes: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });
    vi.mocked(repository.findOutletByCode).mockResolvedValueOnce(null);
    vi.mocked(repository.createOutlet).mockResolvedValueOnce({
      id: "outlet-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      code: "OUT-001",
      name: "Outlet Pusat",
      phone: null,
      address: null,
      status: "ACTIVE",
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    const result = await service.createOutlet("tenant-1", "reseller-1", {
      code: "OUT-001",
      name: "Outlet Pusat",
    });

    expect(result).toMatchObject({
      id: "outlet-1",
      resellerId: "reseller-1",
      code: "OUT-001",
    });
    expect(repository.createOutlet).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      code: "OUT-001",
      name: "Outlet Pusat",
      phone: null,
      address: null,
    });
  });

  it("rejects outlet creation for inactive reseller", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce({
      id: "reseller-1",
      tenantId: "tenant-1",
      code: "RSL-001",
      name: "Inactive Reseller",
      email: null,
      phone: null,
      address: null,
      status: "INACTIVE",
      notes: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    await expect(
      service.createOutlet("tenant-1", "reseller-1", {
        code: "OUT-001",
        name: "Outlet Pusat",
      }),
    ).rejects.toThrow("Reseller tidak aktif");
    expect(repository.createOutlet).not.toHaveBeenCalled();
  });

  it("rejects outlet from a different reseller during ownership assertion", async () => {
    vi.mocked(repository.findOutletById).mockResolvedValueOnce({
      id: "outlet-1",
      tenantId: "tenant-1",
      resellerId: "reseller-other",
      code: "OUT-001",
      name: "Outlet Lain",
      phone: null,
      address: null,
      status: "ACTIVE",
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    await expect(
      service.assertOutletBelongsToReseller(
        "tenant-1",
        "reseller-1",
        "outlet-1",
      ),
    ).rejects.toThrow("Outlet tidak sesuai dengan reseller");
  });
});
