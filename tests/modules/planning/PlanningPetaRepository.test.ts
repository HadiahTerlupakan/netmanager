import { describe, it, expect, vi, beforeEach } from "vitest";

interface NodeTiruan {
  nodeId: string;
  tenantId: string;
  type: string;
  planningId: string | null;
  isPlanned: boolean;
}

interface SyaratNode {
  nodeId?: string;
  tenantId?: string;
  planningId?: string;
  isPlanned?: boolean;
  type?: { in: string[] };
  OR?: SyaratNode[];
}

const { mockNodeCreate, mockEdgeCreate, mockEdgeFindFirst, penyimpanan } =
  vi.hoisted(() => ({
    mockNodeCreate: vi.fn(),
    mockEdgeCreate: vi.fn(),
    mockEdgeFindFirst: vi.fn(),
    penyimpanan: { nodes: [] as NodeTiruan[] },
  }));

/** Evaluator `where` minimal: kesamaan, `type.in`, dan `OR`. */
function cocok(node: NodeTiruan, syarat: SyaratNode): boolean {
  const { OR, type, ...kesamaan } = syarat;
  const cocokKesamaan = Object.entries(kesamaan).every(
    ([kunci, nilai]) => node[kunci as keyof NodeTiruan] === nilai,
  );
  const cocokTipe = !type || type.in.includes(node.type);
  const cocokOr = !OR || OR.some((cabang) => cocok(node, cabang));
  return cocokKesamaan && cocokTipe && cocokOr;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mappingNode: {
      create: mockNodeCreate,
      findFirst: vi.fn(async ({ where }: { where: SyaratNode }) => {
        return penyimpanan.nodes.find((node) => cocok(node, where)) ?? null;
      }),
      findMany: vi.fn(async ({ where }: { where: SyaratNode }) => {
        return penyimpanan.nodes.filter((node) => cocok(node, where));
      }),
    },
    mappingEdge: { create: mockEdgeCreate, findFirst: mockEdgeFindFirst },
  },
}));

import { PlanningPetaRepository } from "@/modules/planning/repositories/PlanningPetaRepository";

function node(overrides: Partial<NodeTiruan>): NodeTiruan {
  return {
    nodeId: "n-1",
    tenantId: "tenant-1",
    type: "odp",
    planningId: "plan-1",
    isPlanned: true,
    ...overrides,
  };
}

describe("PlanningPetaRepository", () => {
  let repo: PlanningPetaRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    penyimpanan.nodes = [];
    repo = new PlanningPetaRepository();
  });

  // Kolom isPlanned bawaannya false; repository inilah satu-satunya yang
  // menandai baris sebagai rencana, jadi invarian ini diuji di sini.
  it("selalu menulis titik dengan isPlanned true", async () => {
    await repo.buatTitik({
      planningId: "plan-1",
      tenantId: "tenant-1",
      type: "odp",
      name: "ODP-01",
      latitude: -6.2,
      longitude: 106.8,
      splitter: "1:8",
      notes: null,
    });

    expect(mockNodeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isPlanned: true,
        planningId: "plan-1",
        tenantId: "tenant-1",
      }),
    });
  });

  it("selalu menulis jalur dengan isPlanned true", async () => {
    await repo.buatJalur({
      planningId: "plan-1",
      tenantId: "tenant-1",
      source: "a",
      target: "b",
      fiberType: "24 core",
      waypoints: null,
      distance: null,
      notes: null,
    });

    expect(mockEdgeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ isPlanned: true, planningId: "plan-1" }),
    });
  });

  describe("ambilTitikMilikPlanning", () => {
    it("hanya mengembalikan titik rencana milik planning itu", async () => {
      penyimpanan.nodes = [
        node({ nodeId: "milik" }),
        node({ nodeId: "lain", planningId: "plan-2" }),
        node({ nodeId: "terbit", isPlanned: false }),
        node({ nodeId: "yatim", planningId: null }),
      ];

      expect(await repo.ambilTitikMilikPlanning("milik", "plan-1")).not.toBe(
        null,
      );
      expect(await repo.ambilTitikMilikPlanning("lain", "plan-1")).toBeNull();
      expect(await repo.ambilTitikMilikPlanning("terbit", "plan-1")).toBeNull();
      expect(await repo.ambilTitikMilikPlanning("yatim", "plan-1")).toBeNull();
    });
  });

  describe("ambilNodeNyataInfrastruktur", () => {
    it("hanya node nyata setenant yang bisa menjadi ujung jalur", async () => {
      penyimpanan.nodes = [
        node({ nodeId: "rencana" }),
        node({ nodeId: "nyata", isPlanned: false, planningId: null }),
        node({
          nodeId: "nyata-tenant-lain",
          isPlanned: false,
          planningId: null,
          tenantId: "tenant-2",
        }),
        node({
          nodeId: "ont-pelanggan",
          isPlanned: false,
          planningId: null,
          type: "ont",
        }),
      ];

      const hasil = await repo.ambilNodeNyataInfrastruktur("tenant-1");

      expect(hasil.map((satu) => satu.nodeId)).toEqual(["nyata"]);
    });
  });

  describe("ambilTitikUjungJalur", () => {
    const ambil = (nodeId: string) =>
      repo.ambilTitikUjungJalur(nodeId, "plan-1", "tenant-1");

    it("menerima titik rencana planning ini dan node nyata setenant", async () => {
      penyimpanan.nodes = [
        node({ nodeId: "rencana" }),
        node({ nodeId: "nyata", isPlanned: false, planningId: null }),
      ];

      expect(await ambil("rencana")).not.toBeNull();
      expect(await ambil("nyata")).not.toBeNull();
    });

    it("menolak node yang tidak ada", async () => {
      expect(await ambil("tidak-ada")).toBeNull();
    });

    it("menolak titik rencana planning lain dan titik rencana yatim", async () => {
      penyimpanan.nodes = [
        node({ nodeId: "lain", planningId: "plan-2" }),
        node({ nodeId: "yatim", planningId: null }),
      ];

      expect(await ambil("lain")).toBeNull();
      expect(await ambil("yatim")).toBeNull();
    });

    it("menolak node milik tenant lain", async () => {
      penyimpanan.nodes = [
        node({
          nodeId: "asing",
          tenantId: "tenant-2",
          isPlanned: false,
          planningId: null,
        }),
      ];

      expect(await ambil("asing")).toBeNull();
    });

    it("menerima olt tetapi menolak customer dan ont", async () => {
      const nyata = { isPlanned: false, planningId: null as string | null };
      penyimpanan.nodes = [
        node({ nodeId: "olt", type: "olt", ...nyata }),
        node({ nodeId: "pelanggan", type: "customer", ...nyata }),
        node({ nodeId: "ont", type: "ont", ...nyata }),
      ];

      expect(await ambil("olt")).not.toBeNull();
      expect(await ambil("pelanggan")).toBeNull();
      expect(await ambil("ont")).toBeNull();
    });
  });

  describe("ambilJalurMilikPlanning", () => {
    it("menyaring planning dan status rencana di query", async () => {
      await repo.ambilJalurMilikPlanning("e-1", "plan-1");

      expect(mockEdgeFindFirst).toHaveBeenCalledWith({
        where: { edgeId: "e-1", planningId: "plan-1", isPlanned: true },
      });
    });
  });
});
