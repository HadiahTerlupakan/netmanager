import { describe, expect, it, vi } from "vitest";

import { TenantContextLookupService } from "@/modules/admin";

describe("TenantContextLookupService", () => {
  it("mengembalikan konteks tenant aktif berdasarkan host", async () => {
    const repository = {
      findActiveByDomain: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    };
    const service = new TenantContextLookupService(repository as never);

    const result = await service.resolveFromHost("Tenant.Example.com:3000");

    expect(repository.findActiveByDomain).toHaveBeenCalledWith(
      "tenant.example.com",
    );
    expect(result).toEqual({ tenantId: "tenant-1", isSuperAdmin: false });
  });

  it("mengembalikan null untuk host kosong atau tenant tidak ditemukan", async () => {
    const repository = {
      findActiveByDomain: vi.fn().mockResolvedValue(null),
    };
    const service = new TenantContextLookupService(repository as never);

    expect(await service.resolveFromHost(null)).toBeNull();
    expect(await service.resolveFromHost("unknown.example.com")).toBeNull();
  });
});
