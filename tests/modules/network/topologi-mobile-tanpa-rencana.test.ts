import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  mappingNode: { findMany: vi.fn() },
  mappingEdge: { findMany: vi.fn(), groupBy: vi.fn() },
  otb: { findMany: vi.fn() },
  pelanggan: { findMany: vi.fn() },
  kmzFile: { findMany: vi.fn() },
}));

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));

import { MobileTopologyRepository } from "@/modules/network/repositories/MobileTopologyRepository";

describe("MobileTopologyRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.mappingNode.findMany.mockResolvedValue([] as never);
    prismaMock.mappingEdge.findMany.mockResolvedValue([] as never);
    prismaMock.mappingEdge.groupBy.mockResolvedValue([] as never);
    prismaMock.otb.findMany.mockResolvedValue([] as never);
    prismaMock.pelanggan.findMany.mockResolvedValue([] as never);
    prismaMock.kmzFile.findMany.mockResolvedValue([] as never);
  });

  it("tidak mengirim node rencana ke aplikasi mobile", async () => {
    await new MobileTopologyRepository().getTopologyData("tenant-1");

    expect(prismaMock.mappingNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", isPlanned: false },
      }),
    );
  });

  it("tidak mengirim jalur rencana ke aplikasi mobile", async () => {
    await new MobileTopologyRepository().getTopologyData("tenant-1");

    expect(prismaMock.mappingEdge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", isPlanned: false },
      }),
    );
  });

  it("tidak menghitung jalur rencana pada rekap jumlah edge", async () => {
    await new MobileTopologyRepository().getTopologyData("tenant-1");

    expect(prismaMock.mappingEdge.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", isPlanned: false },
      }),
    );
  });

  it("menyaring tenant secara tersurat, tidak bersandar pada ekstensi Prisma", async () => {
    await new MobileTopologyRepository().getTopologyData("tenant-1");

    // Ekstensi tenant berhenti menyaring di system context. Ketiga query ini
    // sudah menulis `isPlanned` sendiri, jadi `tenantId` harus tersurat juga —
    // satu penjaga tersurat berdampingan dengan satu penjaga tersirat adalah
    // bentuk yang paling mudah disalahbaca.
    for (const panggilan of [
      prismaMock.mappingNode.findMany,
      prismaMock.mappingEdge.findMany,
      prismaMock.mappingEdge.groupBy,
    ]) {
      const where = panggilan.mock.calls[0][0].where;
      expect(where.tenantId).toBe("tenant-1");
    }
  });
});
