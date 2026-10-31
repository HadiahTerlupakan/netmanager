import { beforeEach, describe, expect, it, vi } from "vitest";

import { setGatewayConfigRevoked } from "@/modules/payment-gateway/services/gateway-config-revocation";

describe("sakelar darurat konfigurasi gateway", () => {
  const repository = { setRevoked: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.setRevoked.mockResolvedValue({
      id: "cfg-1",
      provider: "DUITKU",
      isRevoked: true,
    });
  });

  it("mencabut konfigurasi provider tenant itu", async () => {
    await expect(
      setGatewayConfigRevoked(
        { provider: "DUITKU", tenantId: "tenant-1", isRevoked: true },
        repository,
      ),
    ).resolves.toEqual({ id: "cfg-1", provider: "DUITKU", isRevoked: true });
    expect(repository.setRevoked).toHaveBeenCalledWith(
      "DUITKU",
      "tenant-1",
      true,
    );
  });

  it("provider yang tidak dikenal: null tanpa menyentuh database", async () => {
    await expect(
      setGatewayConfigRevoked(
        { provider: "duitku'--", tenantId: "tenant-1", isRevoked: true },
        repository,
      ),
    ).resolves.toBeNull();
    expect(repository.setRevoked).not.toHaveBeenCalled();
  });
});
