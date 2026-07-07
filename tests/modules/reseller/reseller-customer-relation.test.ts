import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResellerCustomerRelationService } from "@/modules/reseller/services/ResellerCustomerRelationService";
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
    upsertPackagePrice: vi.fn(),
  };
}

describe("ResellerCustomerRelationService", () => {
  let repository: IResellerRepository;
  let service: ResellerCustomerRelationService;

  beforeEach(() => {
    repository = createRepository();
    service = new ResellerCustomerRelationService(repository);
  });

  it("accepts empty customer reseller relation for direct ISP customers", async () => {
    const result = await service.validateCustomerRelation({
      tenantId: "tenant-1",
      resellerId: null,
      resellerOutletId: null,
    });

    expect(result).toEqual({ resellerId: null, resellerOutletId: null });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("accepts active reseller and matching active outlet", async () => {
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
    vi.mocked(repository.findOutletById).mockResolvedValueOnce({
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

    const result = await service.validateCustomerRelation({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      resellerOutletId: "outlet-1",
    });

    expect(result).toEqual({
      resellerId: "reseller-1",
      resellerOutletId: "outlet-1",
    });
  });

  it("rejects outlet without reseller", async () => {
    await expect(
      service.validateCustomerRelation({
        tenantId: "tenant-1",
        resellerId: null,
        resellerOutletId: "outlet-1",
      }),
    ).rejects.toThrow("Reseller wajib dipilih saat outlet reseller diisi");
  });

  it("rejects outlet that belongs to another reseller", async () => {
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
      service.validateCustomerRelation({
        tenantId: "tenant-1",
        resellerId: "reseller-1",
        resellerOutletId: "outlet-1",
      }),
    ).rejects.toThrow("Outlet tidak sesuai dengan reseller");
  });
});
