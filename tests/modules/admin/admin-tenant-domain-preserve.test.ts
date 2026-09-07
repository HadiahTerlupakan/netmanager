import { describe, expect, it, vi } from "vitest";
import { AdminTenantRouteService } from "@/modules/admin/services/AdminTenantRouteService";
import type { ITenantRepository } from "@/modules/admin/domain/ports/ITenantRepository";

/**
 * `Tenant.domain` adalah field warisan: ia membuat resolusi tenant menemukan
 * host, tetapi tidak pernah memicu verifikasi maupun SSL. Form tenant tidak
 * lagi menyuntingnya, jadi payload update tidak menyertakannya — dan payload
 * tanpa field itu tidak boleh diam-diam menghapus domain lama milik tenant.
 */

const buildRepository = () =>
  ({
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    delete: vi.fn(),
    findDuplicateDomain: vi.fn().mockResolvedValue(null),
  }) as unknown as ITenantRepository & { update: ReturnType<typeof vi.fn> };

const updatePayload = (repository: { update: ReturnType<typeof vi.fn> }) =>
  repository.update.mock.calls[0][1] as Record<string, unknown>;

describe("AdminTenantRouteService.updateTenant", () => {
  it("tidak menyentuh domain saat field tidak dikirim", async () => {
    const repository = buildRepository();
    const service = new AdminTenantRouteService(repository);

    await service.updateTenant("tenant-1", { name: "Akses Cepat" });

    expect(updatePayload(repository)).not.toHaveProperty("domain");
  });

  it("mengosongkan domain hanya bila null dikirim eksplisit", async () => {
    const repository = buildRepository();
    const service = new AdminTenantRouteService(repository);

    await service.updateTenant("tenant-1", {
      name: "Akses Cepat",
      domain: null,
    });

    expect(updatePayload(repository)).toMatchObject({ domain: null });
  });

  it("menormalkan domain yang dikirim", async () => {
    const repository = buildRepository();
    const service = new AdminTenantRouteService(repository);

    await service.updateTenant("tenant-1", {
      name: "Akses Cepat",
      domain: "Portal.Klien.COM",
    });

    expect(updatePayload(repository)).toMatchObject({
      domain: "portal.klien.com",
    });
  });
});
