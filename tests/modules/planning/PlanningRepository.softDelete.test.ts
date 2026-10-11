import { describe, it, expect, vi, beforeEach } from "vitest";

interface BarisTopologi {
  id: string;
  planningId: string | null;
  isPlanned: boolean;
}

const { simpan, tx, prismaTiruan } = vi.hoisted(() => {
  const simpan = {
    nodes: [] as BarisTopologi[],
    edges: [] as BarisTopologi[],
  };
  const cocok = (
    baris: BarisTopologi,
    where: { planningId: string; isPlanned: boolean },
  ) =>
    baris.planningId === where.planningId &&
    baris.isPlanned === where.isPlanned;
  const tx = {
    planning: { update: vi.fn() },
    mappingEdge: {
      deleteMany: vi.fn(
        async ({
          where,
        }: {
          where: { planningId: string; isPlanned: boolean };
        }) => {
          simpan.edges = simpan.edges.filter((e) => !cocok(e, where));
        },
      ),
    },
    mappingNode: {
      deleteMany: vi.fn(
        async ({
          where,
        }: {
          where: { planningId: string; isPlanned: boolean };
        }) => {
          simpan.nodes = simpan.nodes.filter((n) => !cocok(n, where));
        },
      ),
    },
  };
  const prismaTiruan = {
    ...tx,
    $transaction: vi.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  return { simpan, tx, prismaTiruan };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaTiruan }));

import { PlanningRepository } from "@/modules/planning/repositories/PlanningRepository";

describe("PlanningRepository.delete (soft delete)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simpan.nodes = [
      { id: "r-1", planningId: "plan-1", isPlanned: true },
      { id: "r-2", planningId: "plan-1", isPlanned: true },
      { id: "t-1", planningId: "plan-1", isPlanned: false },
      { id: "lain", planningId: "plan-2", isPlanned: true },
    ];
    simpan.edges = [{ id: "e-1", planningId: "plan-1", isPlanned: true }];
  });

  it("menyisakan titik terbit saja dan tidak menyentuh planning lain", async () => {
    await new PlanningRepository().delete("plan-1");

    expect(simpan.nodes.map((n) => n.id).sort()).toEqual(["lain", "t-1"]);
    expect(simpan.edges).toHaveLength(0);
  });

  it("menjalankan soft delete dan penghapusan rencana dalam satu transaksi", async () => {
    await new PlanningRepository().delete("plan-1");

    expect(prismaTiruan.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.planning.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" } }),
    );
  });

  it("memakai transaksi pemanggil bila diberikan", async () => {
    await new PlanningRepository().delete("plan-1", tx as never);

    expect(prismaTiruan.$transaction).not.toHaveBeenCalled();
    expect(tx.mappingNode.deleteMany).toHaveBeenCalled();
  });
});
