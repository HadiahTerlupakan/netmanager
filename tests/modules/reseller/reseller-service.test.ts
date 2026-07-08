import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResellerService } from "@/modules/reseller/services/ResellerService";
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

describe("ResellerService", () => {
  let repository: IResellerRepository;
  let service: ResellerService;

  beforeEach(() => {
    repository = createRepository();
    service = new ResellerService(repository);
  });

  it("creates reseller when code is unique for the tenant", async () => {
    vi.mocked(repository.findByCode).mockResolvedValueOnce(null);
    vi.mocked(repository.create).mockResolvedValueOnce({
      id: "reseller-1",
      tenantId: "tenant-1",
      code: "RSL-001",
      name: "Reseller Satu",
      email: "reseller@example.com",
      phone: "628123456789",
      address: "Jl. Fiber",
      status: "ACTIVE",
      notes: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    const result = await service.createReseller({
      tenantId: "tenant-1",
      code: "RSL-001",
      name: "Reseller Satu",
      email: "reseller@example.com",
      phone: "628123456789",
      address: "Jl. Fiber",
      notes: null,
    });

    expect(result).toMatchObject({
      id: "reseller-1",
      code: "RSL-001",
      name: "Reseller Satu",
      status: "ACTIVE",
    });
    expect(repository.create).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      code: "RSL-001",
      name: "Reseller Satu",
      email: "reseller@example.com",
      phone: "628123456789",
      address: "Jl. Fiber",
      notes: null,
    });
  });

  it("rejects duplicate reseller code within the same tenant", async () => {
    vi.mocked(repository.findByCode).mockResolvedValueOnce({
      id: "existing",
      tenantId: "tenant-1",
      code: "RSL-001",
      name: "Existing",
      email: null,
      phone: null,
      address: null,
      status: "ACTIVE",
      notes: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    await expect(
      service.createReseller({
        tenantId: "tenant-1",
        code: "RSL-001",
        name: "Reseller Baru",
      }),
    ).rejects.toThrow("Kode reseller sudah digunakan");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("does not return soft-deleted reseller detail", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    const result = await service.getResellerById("tenant-1", "missing");

    expect(result).toBeNull();
    expect(repository.findById).toHaveBeenCalledWith("tenant-1", "missing");
  });
});
