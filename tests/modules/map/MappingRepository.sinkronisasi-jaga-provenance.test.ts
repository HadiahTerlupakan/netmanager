import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `POST /api/map/sync` dulu berbentuk hapus-semua lalu tulis-ulang.
 *
 * Titik rencana yang SUDAH TERBIT ber-`isPlanned: false`, jadi ia ikut tersapu
 * penghapusan "nyata" — padahal ia tetap memegang `planningId`, dan payload
 * dari UI peta tidak membawa kolom itu. Setiap sinkronisasi karena itu
 * mencabut `planningId` dari setiap titik terbit; karena
 * `PlanningDocument.nodeId` ber-`SET NULL`, foto survei yang menempel ikut
 * terlepas. Hasil survei lapangan sebuah planning hilang sebagai efek samping
 * menekan "sinkronkan".
 *
 * Yang dijaga tes ini: baris yang masih ada di payload DIPERBARUI di tempat,
 * dan pembaruannya tidak pernah menyentuh kolom provenance.
 */

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
      update: vi.fn(),
    },
  };
  return { transaction, $transaction: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { MappingRepository } from "@/modules/map/repositories/MappingRepository";

const ctx = { tenantId: "tenant-1", isSuperAdmin: false };
const repository = new MappingRepository();

const NODE_TERBIT = {
  nodeId: "odp-terbit",
  type: "odp",
  name: "ODP Terbit",
  latitude: -6.2,
  longitude: 106.8,
};
const JALUR_ADA = {
  edgeId: "edge-1",
  source: "odp-terbit",
  target: "odc-1",
  distance: 120,
};

/** Kolom yang kalau ditulis ulang akan menghapus provenance planning. */
const KOLOM_PROVENANCE = ["planningId", "isPlanned"];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.transaction.mappingNode.findMany.mockResolvedValue([]);
  prismaMock.transaction.mappingEdge.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock.transaction) => unknown) =>
      callback(prismaMock.transaction),
  );
});

describe("syncAllMappingData menjaga identitas baris", () => {
  it("memperbarui node yang masih ada di payload, tidak menghapusnya", async () => {
    prismaMock.transaction.mappingNode.findMany.mockResolvedValue([
      { nodeId: "odp-terbit" },
    ] as never);

    await repository.syncAllMappingData(ctx, {
      nodes: [NODE_TERBIT],
      edges: [],
    });

    const { transaction } = prismaMock;
    expect(transaction.mappingNode.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nodeId: "odp-terbit" } }),
    );
    // Penghapusan hanya menyasar yang HILANG dari payload.
    expect(
      transaction.mappingNode.deleteMany.mock.calls[0][0].where.nodeId,
    ).toEqual({ notIn: ["odp-terbit"] });
    // Dan tidak ditulis ulang sebagai baris baru.
    expect(transaction.mappingNode.createMany).not.toHaveBeenCalled();
  });

  it("pembaruan node tidak pernah menyentuh planningId maupun isPlanned", async () => {
    prismaMock.transaction.mappingNode.findMany.mockResolvedValue([
      { nodeId: "odp-terbit" },
    ] as never);

    await repository.syncAllMappingData(ctx, {
      nodes: [NODE_TERBIT],
      edges: [],
    });

    const data = prismaMock.transaction.mappingNode.update.mock.calls[0][0]
      .data as Record<string, unknown>;
    for (const kolom of [...KOLOM_PROVENANCE, "siteId", "photo", "metadata"]) {
      expect(Object.keys(data)).not.toContain(kolom);
    }
    expect(data).toMatchObject({ name: "ODP Terbit", latitude: -6.2 });
  });

  it("pembaruan jalur tidak pernah menyentuh planningId maupun isPlanned", async () => {
    prismaMock.transaction.mappingEdge.findMany.mockResolvedValue([
      { edgeId: "edge-1" },
    ] as never);

    await repository.syncAllMappingData(ctx, {
      nodes: [],
      edges: [JALUR_ADA],
    });

    const data = prismaMock.transaction.mappingEdge.update.mock.calls[0][0]
      .data as Record<string, unknown>;
    for (const kolom of KOLOM_PROVENANCE) {
      expect(Object.keys(data)).not.toContain(kolom);
    }
    expect(data).toMatchObject({ source: "odp-terbit", distance: 120 });
  });

  it("node baru tetap dibuat, node lama tidak ikut dibuat ulang", async () => {
    prismaMock.transaction.mappingNode.findMany.mockResolvedValue([
      { nodeId: "odp-terbit" },
    ] as never);

    await repository.syncAllMappingData(ctx, {
      nodes: [NODE_TERBIT, { ...NODE_TERBIT, nodeId: "odp-baru" }],
      edges: [],
    });

    const { transaction } = prismaMock;
    const dibuat = transaction.mappingNode.createMany.mock.calls[0][0].data as {
      nodeId: string;
    }[];
    expect(dibuat.map((node) => node.nodeId)).toEqual(["odp-baru"]);
    expect(transaction.mappingNode.update).toHaveBeenCalledTimes(1);
  });

  it("payload kosong tetap menghapus seluruh topologi nyata", async () => {
    await repository.syncAllMappingData(ctx, { nodes: [], edges: [] });

    const { transaction } = prismaMock;
    // `notIn: []` berarti "tak satu pun dikecualikan". Arti itu dikunci
    // terhadap Prisma sungguhan di tests/integration/map/.
    expect(
      transaction.mappingNode.deleteMany.mock.calls[0][0].where,
    ).toMatchObject({
      tenantId: "tenant-1",
      isPlanned: false,
      nodeId: { notIn: [] },
    });
    expect(
      transaction.mappingEdge.deleteMany.mock.calls[0][0].where,
    ).toMatchObject({
      tenantId: "tenant-1",
      isPlanned: false,
      edgeId: { notIn: [] },
    });
  });

  it("penghapusan dan pencarian selalu terbatas pada lingkup nyata", async () => {
    await repository.syncAllMappingData(ctx, {
      nodes: [NODE_TERBIT],
      edges: [JALUR_ADA],
    });

    const { transaction } = prismaMock;
    for (const panggilan of [
      transaction.mappingNode.deleteMany,
      transaction.mappingEdge.deleteMany,
      transaction.mappingNode.findMany,
      transaction.mappingEdge.findMany,
    ]) {
      // Tanpa ini sinkronisasi bisa menghapus atau mengambil alih titik
      // rencana yang belum terbit.
      expect(panggilan.mock.calls[0][0].where).toMatchObject({
        tenantId: "tenant-1",
        isPlanned: false,
      });
    }
  });

  it("jalur diperbarui setelah node dibuat, bukan sebelumnya", async () => {
    const urutan: string[] = [];
    const { transaction } = prismaMock;
    transaction.mappingNode.createMany.mockImplementation(async () => {
      urutan.push("node:createMany");
      return { count: 1 };
    });
    transaction.mappingEdge.update.mockImplementation(async () => {
      urutan.push("edge:update");
      return {};
    });
    transaction.mappingEdge.findMany.mockResolvedValue([
      { edgeId: "edge-1" },
    ] as never);

    await repository.syncAllMappingData(ctx, {
      nodes: [{ ...NODE_TERBIT, nodeId: "odp-baru" }],
      edges: [{ ...JALUR_ADA, source: "odp-baru" }],
    });

    // `source` sebuah jalur yang bertahan boleh berpindah ke node yang baru
    // lahir di sinkronisasi ini; urutan sebaliknya melanggar FK.
    expect(urutan).toEqual(["node:createMany", "edge:update"]);
  });
});
