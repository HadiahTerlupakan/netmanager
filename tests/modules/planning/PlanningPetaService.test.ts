import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import type { MappingEdge, MappingNode } from "@prisma/client";

import { PlanningPetaService } from "@/modules/planning/services/PlanningPetaService";
import type { PlanningPetaRepository } from "@/modules/planning/repositories/PlanningPetaRepository";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import {
  PlanningEntity,
  type PlanningStatus,
} from "@/modules/planning/domain/entities/PlanningEntity";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
  PlanningValidationError,
} from "@/modules/planning/errors/planning-errors";
import { createFakeUnitOfWork } from "./helpers/fakeUnitOfWork";

const now = new Date("2026-10-11T00:00:00.000Z");

function planning(status: PlanningStatus = "BACKLOG", tenantId = "tenant-1") {
  return new PlanningEntity({
    id: "plan-1",
    tenantId,
    type: "OSP",
    title: "Ekspansi FO Cipinang",
    description: null,
    area: "Cipinang",
    coordinates: null,
    estimatedUnits: 100,
    estimatedBudget: 5_000_000,
    actualBudget: null,
    status,
    approvalLevel: 1,
    currentApprovalStep: 0,
    submittedAt: null,
    submittedById: null,
    approvedAt: null,
    approvedById: null,
    approvedLevel1At: null,
    approvedLevel1ById: null,
    rejectedAt: null,
    rejectedById: null,
    approvalNotes: null,
    progressPercentage: 0,
    startDate: null,
    targetCompletionDate: null,
    actualCompletionDate: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

function node(overrides: Partial<MappingNode> = {}): MappingNode {
  return {
    nodeId: "n-1",
    type: "odp",
    name: "ODP-01",
    latitude: -6.2,
    longitude: 106.8,
    capacity: 0,
    splitter: "1:8",
    notes: null,
    tenantId: "tenant-1",
    planningId: "plan-1",
    isPlanned: true,
    ...overrides,
  } as MappingNode;
}

function edge(overrides: Partial<MappingEdge> = {}): MappingEdge {
  return {
    edgeId: "e-1",
    source: "n-1",
    target: "n-2",
    fiberType: "24 core",
    distance: 120,
    waypoints: null,
    notes: null,
    tenantId: "tenant-1",
    planningId: "plan-1",
    isPlanned: true,
    ...overrides,
  } as MappingEdge;
}

const masukanTitik = {
  type: "odp" as const,
  name: "ODP-01",
  latitude: -6.2,
  longitude: 106.8,
  splitter: "1:8",
  notes: null,
};

describe("PlanningPetaService", () => {
  let service: PlanningPetaService;
  let planningRepo: Mocked<IPlanningRepository>;
  let repo: Mocked<PlanningPetaRepository>;
  let audit: Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();

    planningRepo = {
      findById: vi.fn().mockResolvedValue(planning()),
    } as unknown as Mocked<IPlanningRepository>;

    repo = {
      buatTitik: vi.fn().mockResolvedValue(node()),
      ubahTitik: vi.fn().mockResolvedValue(node()),
      hapusTitik: vi.fn().mockResolvedValue(undefined),
      ambilTitik: vi.fn().mockResolvedValue(node()),
      ambilTitikPerPlanning: vi.fn().mockResolvedValue([node()]),
      ambilTitikYatim: vi.fn().mockResolvedValue([]),
      hitungJalurTerhubung: vi.fn().mockResolvedValue(0),
      buatJalur: vi.fn().mockResolvedValue(edge()),
      ambilJalur: vi.fn().mockResolvedValue(edge()),
      hapusJalur: vi.fn().mockResolvedValue(undefined),
      ambilJalurPerPlanning: vi.fn().mockResolvedValue([edge()]),
    } as unknown as Mocked<PlanningPetaRepository>;

    audit = { logChange: vi.fn() } as unknown as Mocked<PlanningAuditService>;

    service = new PlanningPetaService(
      planningRepo,
      repo,
      audit,
      createFakeUnitOfWork(),
    );
  });

  describe("tambahTitik", () => {
    it("menautkan titik baru ke planning dan tenant pemanggil, lalu mengaudit", async () => {
      await service.tambahTitik("plan-1", masukanTitik, "user-1", "tenant-1");

      expect(repo.buatTitik).toHaveBeenCalledWith(
        expect.objectContaining({ planningId: "plan-1", tenantId: "tenant-1" }),
        undefined,
      );
      expect(audit.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          action: "UPDATED",
          performedById: "user-1",
        }),
        undefined,
      );
    });

    it("menolak planning milik tenant lain", async () => {
      planningRepo.findById.mockResolvedValue(planning("BACKLOG", "lain"));

      await expect(
        service.tambahTitik("plan-1", masukanTitik, "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningNotFoundError);
      expect(repo.buatTitik).not.toHaveBeenCalled();
    });

    it("menolak mengubah peta planning yang sudah disetujui", async () => {
      planningRepo.findById.mockResolvedValue(planning("APPROVED"));

      await expect(
        service.tambahTitik("plan-1", masukanTitik, "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningInvalidStateError);
      expect(repo.buatTitik).not.toHaveBeenCalled();
    });
  });

  describe("ubahTitik", () => {
    it("menolak titik milik planning lain", async () => {
      repo.ambilTitik.mockResolvedValue(node({ planningId: "plan-lain" }));

      await expect(
        service.ubahTitik("plan-1", "n-1", masukanTitik, "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningNotFoundError);
      expect(repo.ubahTitik).not.toHaveBeenCalled();
    });

    it("menolak titik yang sudah terbit", async () => {
      repo.ambilTitik.mockResolvedValue(node({ isPlanned: false }));

      await expect(
        service.ubahTitik("plan-1", "n-1", masukanTitik, "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningInvalidStateError);
    });

    it("menolak penggantian jenis titik", async () => {
      await expect(
        service.ubahTitik(
          "plan-1",
          "n-1",
          { ...masukanTitik, type: "odc" },
          "user-1",
          "tenant-1",
        ),
      ).rejects.toBeInstanceOf(PlanningValidationError);
    });

    it("menyimpan perubahan dan mengaudit", async () => {
      await service.ubahTitik(
        "plan-1",
        "n-1",
        { ...masukanTitik, splitter: "1:16" },
        "user-1",
        "tenant-1",
      );

      expect(repo.ubahTitik).toHaveBeenCalledWith(
        "n-1",
        expect.objectContaining({ splitter: "1:16" }),
        undefined,
      );
      expect(audit.logChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("hapusTitik", () => {
    it("menolak titik yang bukan milik planning itu", async () => {
      repo.ambilTitik.mockResolvedValue(node({ planningId: "plan-lain" }));

      await expect(
        service.hapusTitik("plan-1", "n-1", "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningNotFoundError);
      expect(repo.hapusTitik).not.toHaveBeenCalled();
    });

    it("menolak menghapus titik yang sudah terbit menjadi node nyata", async () => {
      repo.ambilTitik.mockResolvedValue(node({ isPlanned: false }));

      await expect(
        service.hapusTitik("plan-1", "n-1", "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningInvalidStateError);
      expect(repo.hapusTitik).not.toHaveBeenCalled();
    });

    it("menolak menghapus titik yang masih punya jalur", async () => {
      repo.hitungJalurTerhubung.mockResolvedValue(2);

      await expect(
        service.hapusTitik("plan-1", "n-1", "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningInvalidStateError);
      expect(repo.hapusTitik).not.toHaveBeenCalled();
    });

    it("menghapus titik rencana yang bebas jalur dan mengaudit", async () => {
      await service.hapusTitik("plan-1", "n-1", "user-1", "tenant-1");

      expect(repo.hapusTitik).toHaveBeenCalledWith("n-1", undefined);
      expect(audit.logChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("tambahJalur", () => {
    const masukanJalur = {
      source: "n-1",
      target: "n-2",
      fiberType: "24 core",
      waypoints: [[-6.2, 106.8]] as Array<[number, number]>,
      distance: 120,
      notes: null,
    };

    beforeEach(() => {
      repo.ambilTitik.mockImplementation(async (id: string) =>
        node({ nodeId: id }),
      );
    });

    it("menandai planningId dan menyimpan waypoints sebagai JSON string", async () => {
      await service.tambahJalur("plan-1", masukanJalur, "user-1", "tenant-1");

      expect(repo.buatJalur).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          waypoints: JSON.stringify([[-6.2, 106.8]]),
        }),
        undefined,
      );
    });

    it("menyimpan waypoints null bila kosong", async () => {
      await service.tambahJalur(
        "plan-1",
        { ...masukanJalur, waypoints: [] },
        "user-1",
        "tenant-1",
      );

      expect(repo.buatJalur).toHaveBeenCalledWith(
        expect.objectContaining({ waypoints: null }),
        undefined,
      );
    });

    it("menolak ujung jalur yang bukan titik planning itu", async () => {
      repo.ambilTitik.mockImplementation(async (id: string) =>
        node({ nodeId: id, planningId: id === "n-2" ? "plan-lain" : "plan-1" }),
      );

      await expect(
        service.tambahJalur("plan-1", masukanJalur, "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningNotFoundError);
      expect(repo.buatJalur).not.toHaveBeenCalled();
    });

    it("menolak jalur yang asal dan tujuannya sama", async () => {
      await expect(
        service.tambahJalur(
          "plan-1",
          { ...masukanJalur, target: "n-1" },
          "user-1",
          "tenant-1",
        ),
      ).rejects.toBeInstanceOf(PlanningValidationError);
    });

    it("menolak planning yang sudah disetujui", async () => {
      planningRepo.findById.mockResolvedValue(planning("APPROVED"));

      await expect(
        service.tambahJalur("plan-1", masukanJalur, "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningInvalidStateError);
    });
  });

  describe("hapusJalur", () => {
    it("menolak jalur milik planning lain", async () => {
      repo.ambilJalur.mockResolvedValue(edge({ planningId: "plan-lain" }));

      await expect(
        service.hapusJalur("plan-1", "e-1", "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningNotFoundError);
    });

    it("menolak jalur yang sudah terbit", async () => {
      repo.ambilJalur.mockResolvedValue(edge({ isPlanned: false }));

      await expect(
        service.hapusJalur("plan-1", "e-1", "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningInvalidStateError);
      expect(repo.hapusJalur).not.toHaveBeenCalled();
    });

    it("menghapus jalur rencana dan mengaudit", async () => {
      await service.hapusJalur("plan-1", "e-1", "user-1", "tenant-1");

      expect(repo.hapusJalur).toHaveBeenCalledWith("e-1", undefined);
      expect(audit.logChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("ambilPeta", () => {
    it("mengurai waypoints JSON menjadi array koordinat", async () => {
      repo.ambilJalurPerPlanning.mockResolvedValue([
        edge({ waypoints: JSON.stringify([[-6.2, 106.8]]) }),
      ]);

      const peta = await service.ambilPeta("plan-1", "tenant-1");

      expect(peta.titik).toHaveLength(1);
      expect(peta.jalur[0].waypoints).toEqual([[-6.2, 106.8]]);
    });

    it("tidak menjatuhkan peta karena waypoints rusak", async () => {
      repo.ambilJalurPerPlanning.mockResolvedValue([
        edge({ waypoints: "bukan json" }),
      ]);

      const peta = await service.ambilPeta("plan-1", "tenant-1");

      expect(peta.jalur[0].waypoints).toEqual([]);
    });

    it("menolak planning milik tenant lain", async () => {
      planningRepo.findById.mockResolvedValue(planning("BACKLOG", "lain"));

      await expect(
        service.ambilPeta("plan-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningNotFoundError);
    });

    it("tetap terbaca pada planning yang sudah disetujui", async () => {
      planningRepo.findById.mockResolvedValue(planning("APPROVED"));

      await expect(
        service.ambilPeta("plan-1", "tenant-1"),
      ).resolves.toBeDefined();
    });
  });

  describe("ambilTitikYatim", () => {
    it("mengembalikan titik rencana yatim agar tetap bisa dirapikan", async () => {
      // planningId null + isPlanned true terjadi bila planning induknya
      // dihapus (onDelete: SetNull).
      repo.ambilTitikYatim.mockResolvedValue([
        node({ nodeId: "n-yatim", planningId: null }),
      ]);

      await expect(service.ambilTitikYatim("tenant-1")).resolves.toHaveLength(
        1,
      );
      expect(repo.ambilTitikYatim).toHaveBeenCalledWith("tenant-1");
    });
  });
});
