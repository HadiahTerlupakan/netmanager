import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import type { MappingNode } from "@prisma/client";

import {
  PlanningDocumentService,
  type SimpanGambarPlanning,
} from "@/modules/planning/services/PlanningDocumentService";
import type { IPlanningDocumentRepository } from "@/modules/planning/domain/ports/IPlanningDocumentRepository";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import type { PlanningPetaRepository } from "@/modules/planning/repositories/PlanningPetaRepository";
import { PlanningDocumentEntity } from "@/modules/planning/domain/entities/PlanningDocumentEntity";
import { unggahDokumenPlanningSchema } from "@/modules/planning/validators/planningDocumentSchemas";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import {
  PlanningNotFoundError,
  PlanningValidationError,
} from "@/modules/planning/errors/planning-errors";

const now = new Date("2026-10-11T00:00:00.000Z");

function planning(tenantId = "tenant-1") {
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
    status: "BACKLOG",
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

function foto(name = "odp.jpg", type = "image/jpeg", size = 1024): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("foto survei per titik rencana", () => {
  let planningRepo: Mocked<Pick<IPlanningRepository, "findById">>;
  let documentRepo: Mocked<Pick<IPlanningDocumentRepository, "create">>;
  let petaRepo: Mocked<Pick<PlanningPetaRepository, "ambilTitikMilikPlanning">>;
  let simpanGambar: Mocked<SimpanGambarPlanning>;
  let auditService: Mocked<Pick<PlanningAuditService, "logChange">>;
  let service: PlanningDocumentService;

  beforeEach(() => {
    planningRepo = { findById: vi.fn().mockResolvedValue(planning()) };
    documentRepo = {
      create: vi.fn().mockImplementation(
        async (data) =>
          new PlanningDocumentEntity({
            id: "doc-1",
            uploadedAt: now,
            fileSize: data.fileSize ?? null,
            mimeType: data.mimeType ?? null,
            description: data.description ?? null,
            uploadedById: data.uploadedById ?? null,
            ...data,
          }),
      ),
    };
    petaRepo = {
      ambilTitikMilikPlanning: vi
        .fn()
        .mockResolvedValue({ nodeId: "n-1" } as MappingNode),
    };
    auditService = { logChange: vi.fn().mockResolvedValue({}) };
    simpanGambar = vi.fn().mockResolvedValue("/uploads/odp.webp");
    service = new PlanningDocumentService(
      planningRepo as unknown as IPlanningRepository,
      documentRepo as unknown as IPlanningDocumentRepository,
      petaRepo as unknown as PlanningPetaRepository,
      auditService as unknown as PlanningAuditService,
      simpanGambar,
    );
  });

  it("menautkan foto survei ke titik rencananya", async () => {
    const hasil = await service.upload(
      "plan-1",
      { file: foto(), nodeId: "n-1", category: "OTHER" },
      "user-1",
      "tenant-1",
    );

    expect(petaRepo.ambilTitikMilikPlanning).toHaveBeenCalledWith(
      "n-1",
      "plan-1",
    );
    expect(documentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: "n-1",
        category: "SURVEY_PHOTO",
        fileUrl: "/uploads/odp.webp",
        uploadedById: "user-1",
        tenantId: "tenant-1",
      }),
    );
    expect(hasil.nodeId).toBe("n-1");
  });

  it("mencatat audit DOCUMENT_UPLOADED setelah dokumen dibuat", async () => {
    await service.upload(
      "plan-1",
      { file: foto(), nodeId: "n-1" },
      "user-1",
      "tenant-1",
    );

    expect(auditService.logChange).toHaveBeenCalledWith(
      expect.objectContaining({
        planningId: "plan-1",
        tenantId: "tenant-1",
        action: "DOCUMENT_UPLOADED",
        performedById: "user-1",
        changes: expect.objectContaining({
          documentId: "doc-1",
          nodeId: "n-1",
        }),
      }),
    );
  });

  it("menolak kategori berkas dokumen pada skema unggah", () => {
    const hasil = unggahDokumenPlanningSchema.safeParse({
      category: "APPROVAL_DOCUMENT",
    });

    expect(hasil.success).toBe(false);
  });

  it("menolak menautkan foto ke titik milik planning lain", async () => {
    petaRepo.ambilTitikMilikPlanning.mockResolvedValue(null);

    await expect(
      service.upload(
        "plan-1",
        { file: foto(), nodeId: "n-1" },
        "user-1",
        "tenant-1",
      ),
    ).rejects.toBeInstanceOf(PlanningNotFoundError);

    expect(simpanGambar).not.toHaveBeenCalled();
    expect(documentRepo.create).not.toHaveBeenCalled();
  });

  it("tetap menerima dokumen tanpa nodeId sebagai lampiran proyek", async () => {
    await service.upload(
      "plan-1",
      { file: foto(), category: "NETWORK_DIAGRAM" },
      "user-1",
      "tenant-1",
    );

    expect(petaRepo.ambilTitikMilikPlanning).not.toHaveBeenCalled();
    expect(documentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: null, category: "NETWORK_DIAGRAM" }),
    );
  });

  it("memakai kategori OTHER bila lampiran proyek tak menyebut kategori", async () => {
    await service.upload("plan-1", { file: foto() }, "user-1", "tenant-1");

    expect(documentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: "OTHER" }),
    );
  });

  it("menolak planning milik tenant lain", async () => {
    await expect(
      service.upload("plan-1", { file: foto() }, "user-1", "tenant-lain"),
    ).rejects.toBeInstanceOf(PlanningNotFoundError);
  });

  it("menolak berkas yang bukan gambar", async () => {
    await expect(
      service.upload(
        "plan-1",
        { file: foto("a.pdf", "application/pdf") },
        "user-1",
        "tenant-1",
      ),
    ).rejects.toBeInstanceOf(PlanningValidationError);
  });

  it("menolak foto di atas 5MB", async () => {
    await expect(
      service.upload(
        "plan-1",
        { file: foto("besar.jpg", "image/jpeg", 6 * 1024 * 1024) },
        "user-1",
        "tenant-1",
      ),
    ).rejects.toBeInstanceOf(PlanningValidationError);
    expect(simpanGambar).not.toHaveBeenCalled();
  });
});
