import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminTenantRouteService } from "@/modules/admin/services/AdminTenantRouteService";
import type { ITenantRepository } from "@/modules/admin/domain/ports/ITenantRepository";

const tenant = {
  id: "tenant-1",
  name: "Tenant Satu",
  domain: "tenant.test",
  isActive: true,
  createdAt: new Date("2026-04-27T08:00:00.000Z"),
  updatedAt: new Date("2026-04-27T08:00:00.000Z"),
};

function createRepository(): ITenantRepository {
  return {
    findMany: vi.fn().mockResolvedValue([tenant]),
    create: vi.fn().mockResolvedValue(tenant),
    update: vi.fn().mockResolvedValue(tenant),
    delete: vi.fn().mockResolvedValue(undefined),
    findDuplicateDomain: vi.fn().mockResolvedValue(null),
    findActiveByDomain: vi.fn().mockResolvedValue(tenant),
  };
}

describe("AdminTenantRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengambil tenant aktif lewat repository", async () => {
    const repository = createRepository();
    const service = new AdminTenantRouteService(repository);

    const result = await service.getTenants({ activeOnly: true });

    expect(repository.findMany).toHaveBeenCalledWith({ activeOnly: true });
    expect(result).toEqual([tenant]);
  });

  it("menolak update ketika domain sudah dipakai tenant lain", async () => {
    const repository = createRepository();
    vi.mocked(repository.findDuplicateDomain).mockResolvedValue(tenant);
    const service = new AdminTenantRouteService(repository);

    const result = await service.updateTenant("tenant-2", {
      name: "Tenant Dua",
      domain: "tenant.test",
    });

    expect(repository.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: {
        code: "DUPLICATE_DOMAIN",
        message: "Domain is already used by another tenant",
      },
    });
  });
});
