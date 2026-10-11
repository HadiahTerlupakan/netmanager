import { describe, expect, it, vi } from "vitest";

import { MappingService } from "@/modules/map/services/MappingService";
import type { IMappingRepository } from "@/modules/map/domain/ports/IMappingRepository";

const CTX = { tenantId: "tenant-1", isSuperAdmin: false };

function buatService() {
  const findAllNodes = vi.fn().mockResolvedValue([]);
  const repo = { findAllNodes } as unknown as IMappingRepository;
  return { service: new MappingService(repo), findAllNodes };
}

describe("MappingService.getOdpOptions", () => {
  it("selalu meminta lingkup nyata", async () => {
    const { service, findAllNodes } = buatService();
    await service.getOdpOptions(CTX, undefined);
    expect(findAllNodes.mock.calls[0][1].lingkup).toBe("nyata");
  });

  it("menimpa lingkup rencana/semua yang dikirim pemanggil", async () => {
    const { service, findAllNodes } = buatService();
    await service.getOdpOptions(CTX, { lingkup: "semua" });
    expect(findAllNodes.mock.calls[0][1].lingkup).toBe("nyata");
  });
});

describe("MappingService.isInstalledOdp", () => {
  function buatServiceDenganNode(node: { type: string } | null) {
    const findNodeById = vi.fn().mockResolvedValue(node);
    const repo = { findNodeById } as unknown as IMappingRepository;
    return { service: new MappingService(repo), findNodeById };
  }

  it("menerima node nyata bertipe odp", async () => {
    const { service } = buatServiceDenganNode({ type: "odp" });
    await expect(service.isInstalledOdp(CTX, "n1")).resolves.toBe(true);
  });

  it("menolak node bertipe lain", async () => {
    const { service } = buatServiceDenganNode({ type: "odc" });
    await expect(service.isInstalledOdp(CTX, "n1")).resolves.toBe(false);
  });

  it("menolak node yang tidak ditemukan (termasuk node rencana, tersaring bawaan)", async () => {
    const { service, findNodeById } = buatServiceDenganNode(null);
    await expect(service.isInstalledOdp(CTX, "n1")).resolves.toBe(false);
    expect(findNodeById).toHaveBeenCalledWith(CTX, "n1");
  });
});
