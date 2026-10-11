import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const transaction = {
    mappingEdge: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    mappingNode: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    transaction,
    mappingNode: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    mappingEdge: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    $transaction: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { MappingRepository } from "@/modules/map/repositories/MappingRepository";

const ctx = { tenantId: "tenant-1", isSuperAdmin: false };
const repository = new MappingRepository();

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.mappingNode.findFirst.mockResolvedValue(null);
  prismaMock.mappingNode.findMany.mockResolvedValue([]);
  prismaMock.mappingEdge.findFirst.mockResolvedValue(null);
  prismaMock.mappingEdge.findMany.mockResolvedValue([]);
  prismaMock.mappingEdge.count.mockResolvedValue(0);
  prismaMock.mappingNode.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.mappingEdge.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.transaction.mappingNode.findMany.mockResolvedValue([]);
  prismaMock.transaction.mappingEdge.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock.transaction) => unknown) =>
      callback(prismaMock.transaction),
  );
});

describe("MappingRepository — penyaring node/jalur rencana", () => {
  it("findAllEdges menyaring isPlanned: false secara bawaan", async () => {
    await repository.findAllEdges(ctx);
    const { where } = prismaMock.mappingEdge.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ tenantId: "tenant-1", isPlanned: false });
  });

  it("findNodeById menyaring node nyata secara bawaan", async () => {
    await repository.findNodeById(ctx, "n1");
    const { where } = prismaMock.mappingNode.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ nodeId: "n1", isPlanned: false });
  });

  it("findNodeById dengan lingkup rencana menembus penyaring", async () => {
    await repository.findNodeById(ctx, "n1", "rencana");
    const { where } = prismaMock.mappingNode.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ nodeId: "n1", isPlanned: true });
  });

  it("findEdgeById menyaring edge nyata bawaan dan bisa meminta rencana", async () => {
    await repository.findEdgeById(ctx, "e1");
    await repository.findEdgeById(ctx, "e1", "rencana");
    const calls = prismaMock.mappingEdge.findFirst.mock.calls;
    expect(calls[0][0].where).toMatchObject({ isPlanned: false });
    expect(calls[1][0].where).toMatchObject({ isPlanned: true });
  });

  it("findEdgesByNode menyaring edge nyata bawaan dan bisa meminta rencana", async () => {
    await repository.findEdgesByNode(ctx, "n1");
    await repository.findEdgesByNode(ctx, "n1", "rencana");
    const calls = prismaMock.mappingEdge.findMany.mock.calls;
    expect(calls[0][0].where).toMatchObject({ isPlanned: false });
    expect(calls[1][0].where).toMatchObject({ isPlanned: true });
  });

  it("countEdgesFromSource tidak menghitung edge rencana secara bawaan", async () => {
    await repository.countEdgesFromSource(ctx, "n1");
    await repository.countEdgesFromSource(ctx, "n1", "rencana");
    const calls = prismaMock.mappingEdge.count.mock.calls;
    expect(calls[0][0].where).toMatchObject({ source: "n1", isPlanned: false });
    expect(calls[1][0].where).toMatchObject({ source: "n1", isPlanned: true });
  });

  it("resetAllMappingData hanya menghapus data nyata", async () => {
    await repository.resetAllMappingData(ctx);
    const { transaction } = prismaMock;
    expect(
      transaction.mappingEdge.deleteMany.mock.calls[0][0].where,
    ).toMatchObject({ tenantId: "tenant-1", isPlanned: false });
    expect(
      transaction.mappingNode.deleteMany.mock.calls[0][0].where,
    ).toMatchObject({ tenantId: "tenant-1", isPlanned: false });
  });

  it("syncAllMappingData hanya menghapus data nyata", async () => {
    await repository.syncAllMappingData(ctx, { nodes: [], edges: [] });
    const { transaction } = prismaMock;
    expect(
      transaction.mappingEdge.deleteMany.mock.calls[0][0].where,
    ).toMatchObject({ isPlanned: false });
    expect(
      transaction.mappingNode.deleteMany.mock.calls[0][0].where,
    ).toMatchObject({ isPlanned: false });
  });

  it("upsertNodes hanya mencari node nyata yang sudah ada", async () => {
    await repository.upsertNodes(ctx, [{ nodeId: "n1", type: "odp" }]);
    const { where } = prismaMock.mappingNode.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ isPlanned: false, nodeId: { in: ["n1"] } });
  });

  it("updateNode menyaring node nyata bawaan dan bisa meminta rencana", async () => {
    await expect(repository.updateNode(ctx, "n1", {})).rejects.toThrow();
    await expect(
      repository.updateNode(ctx, "n1", {}, "rencana"),
    ).rejects.toThrow();
    const calls = prismaMock.mappingNode.updateMany.mock.calls;
    expect(calls[0][0].where).toMatchObject({ nodeId: "n1", isPlanned: false });
    expect(calls[1][0].where).toMatchObject({ nodeId: "n1", isPlanned: true });
  });

  it("updateEdge menyaring edge nyata bawaan dan bisa meminta rencana", async () => {
    await expect(repository.updateEdge(ctx, "e1", {})).rejects.toThrow();
    await expect(
      repository.updateEdge(ctx, "e1", {}, "rencana"),
    ).rejects.toThrow();
    const calls = prismaMock.mappingEdge.updateMany.mock.calls;
    expect(calls[0][0].where).toMatchObject({ edgeId: "e1", isPlanned: false });
    expect(calls[1][0].where).toMatchObject({ edgeId: "e1", isPlanned: true });
  });
});
