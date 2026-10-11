import { describe, expect, it, vi } from "vitest";

import { MappingService } from "@/modules/map/services/MappingService";
import type { IMappingRepository } from "@/modules/map/domain/ports/IMappingRepository";

const CTX = { tenantId: "tenant-1", isSuperAdmin: false };

function buatService(jalurRencana: unknown[]) {
  const findEdgesByNode = vi.fn().mockResolvedValue(jalurRencana);
  const deleteNode = vi.fn().mockResolvedValue({
    nodeId: "odc-1",
    type: "odc",
    createdAt: new Date("2026-10-12T00:00:00.000Z"),
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
  });
  const repo = { findEdgesByNode, deleteNode } as unknown as IMappingRepository;
  return { service: new MappingService(repo), findEdgesByNode, deleteNode };
}

describe("MappingService.deleteNode menjaga anggaran planning", () => {
  it("menolak menghapus node yang masih punya jalur kabel rencana", async () => {
    const { service, deleteNode } = buatService([
      { edgeId: "e1" },
      { edgeId: "e2" },
    ]);

    await expect(service.deleteNode(CTX, "odc-1")).rejects.toThrow(
      /2 jalur kabel rencana/,
    );
    // Yang dijaga bukan pesannya, tapi bahwa penghapusan tidak pernah terjadi:
    // sapuan repository akan ikut menghapus kabel rencana itu.
    expect(deleteNode).not.toHaveBeenCalled();
  });

  it("membalas 400, bukan 500, lewat ValidationError", async () => {
    const { service } = buatService([{ edgeId: "e1" }]);

    await expect(service.deleteNode(CTX, "odc-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details: { nodeId: "odc-1", jumlahJalurRencana: 1 },
    });
  });

  it("membaca lingkup rencana, bukan bawaan nyata", async () => {
    const { service, findEdgesByNode } = buatService([]);
    await service.deleteNode(CTX, "odc-1");

    // Dengan bawaan "nyata" penjaga ini membaca himpunan yang salah dan
    // selalu lolos — jalur rencana tidak akan pernah terlihat.
    expect(findEdgesByNode).toHaveBeenCalledWith(CTX, "odc-1", "rencana");
  });

  it("meneruskan penghapusan ketika tidak ada jalur rencana", async () => {
    const { service, deleteNode } = buatService([]);

    await expect(service.deleteNode(CTX, "odc-1")).resolves.toMatchObject({
      nodeId: "odc-1",
    });
    expect(deleteNode).toHaveBeenCalledWith(CTX, "odc-1");
  });
});
