import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNodeCreate, mockEdgeCreate } = vi.hoisted(() => ({
  mockNodeCreate: vi.fn(),
  mockEdgeCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mappingNode: { create: mockNodeCreate },
    mappingEdge: { create: mockEdgeCreate },
  },
}));

import { PlanningPetaRepository } from "@/modules/planning/repositories/PlanningPetaRepository";

describe("PlanningPetaRepository", () => {
  let repo: PlanningPetaRepository;

  beforeEach(() => {
    vi.clearAllMocks();
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
});
