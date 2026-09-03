import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { PlanningTemplateService } from "@/modules/planning/services/PlanningTemplateService";
import type { IPlanningTemplateRepository } from "@/modules/planning/domain/ports/IPlanningTemplateRepository";
import type { IPlanningTemplateItemRepository } from "@/modules/planning/domain/ports/IPlanningTemplateItemRepository";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "@/modules/planning/domain/ports/IPlanningItemRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningTemplateEntity } from "@/modules/planning/domain/entities/PlanningTemplateEntity";
import { PlanningTemplateItemEntity } from "@/modules/planning/domain/entities/PlanningTemplateItemEntity";
import { PlanningItemEntity } from "@/modules/planning/domain/entities/PlanningItemEntity";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import type { CreatePlanningDTO } from "@/modules/planning/dto/PlanningDTO";

/**
 * Menerapkan template adalah SATU-SATUNYA alasan fitur template ada: menyalin
 * daftar material (BOQ) yang sudah baku ke planning baru. Sebelum perbaikan ini
 * applyTemplate menghitung anggaran dari item template lalu mengembalikan
 * `items: []` tanpa pernah menulis satu baris pun ke PlanningItem.
 *
 * Akibatnya planning hasil template lahir dengan estimatedBudget terisi tapi nol
 * item -- tepat kondisi yang ditandai hasBudgetMismatch() sebagai selisih BOQ.
 */
describe("PlanningTemplateService.applyTemplate — penyalinan item", () => {
  let service: PlanningTemplateService;
  let mockTemplateRepo: Mocked<IPlanningTemplateRepository>;
  let mockTemplateItemRepo: Mocked<IPlanningTemplateItemRepository>;
  let mockPlanningRepo: Mocked<IPlanningRepository>;
  let mockItemRepo: Mocked<IPlanningItemRepository>;
  let mockAuditService: Mocked<PlanningAuditService>;

  const templateItem = (
    over: Partial<ConstructorParameters<typeof PlanningTemplateItemEntity>[0]>,
  ) =>
    new PlanningTemplateItemEntity({
      id: "ti-1",
      templateId: "template-1",
      tenantId: "tenant-1",
      name: "Kabel Fiber 24 Core",
      description: null,
      quantity: 100,
      unit: "meter",
      estimatedPrice: 50_000,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    });

  beforeEach(() => {
    vi.clearAllMocks();

    mockTemplateRepo = {
      findById: vi.fn(),
    } as unknown as Mocked<IPlanningTemplateRepository>;

    mockTemplateItemRepo = {
      findByTemplateId: vi.fn(),
    } as unknown as Mocked<IPlanningTemplateItemRepository>;

    mockPlanningRepo = {
      create: vi.fn(),
    } as unknown as Mocked<IPlanningRepository>;

    mockItemRepo = {
      create: vi.fn(),
    } as unknown as Mocked<IPlanningItemRepository>;

    mockAuditService = {
      logChange: vi.fn(),
    } as unknown as Mocked<PlanningAuditService>;

    service = new PlanningTemplateService(
      mockTemplateRepo,
      mockTemplateItemRepo,
      mockPlanningRepo,
      mockItemRepo,
      mockAuditService,
    );

    mockTemplateRepo.findById.mockResolvedValue(
      new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "OSP Standar 100 Unit",
        description: null,
        type: "OSP",
        isActive: true,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    mockPlanningRepo.create.mockResolvedValue(
      new PlanningEntity({
        id: "planning-1",
        tenantId: "tenant-1",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }),
    );

    mockItemRepo.create.mockImplementation(
      async (data) =>
        new PlanningItemEntity({
          id: `pi-${data.name}`,
          planningId: data.planningId,
          tenantId: data.tenantId,
          name: data.name,
          description: data.description ?? null,
          quantity: data.quantity,
          unit: data.unit,
          estimatedPrice: data.estimatedPrice ?? null,
          actualPrice: data.actualPrice ?? null,
          notes: data.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
    );
  });

  const applyInput: Omit<CreatePlanningDTO, "type"> = {
    title: "Ekspansi FO Cipinang",
    description: null,
    area: "Cipinang",
    coordinates: null,
    estimatedUnits: 100,
    startDate: null,
    targetCompletionDate: null,
  };

  it("menulis setiap item template ke PlanningItem milik planning baru", async () => {
    mockTemplateItemRepo.findByTemplateId.mockResolvedValue([
      templateItem({ id: "ti-1", name: "Kabel Fiber 24 Core" }),
      templateItem({
        id: "ti-2",
        name: "Closure 24 Core",
        quantity: 4,
        unit: "unit",
        estimatedPrice: 750_000,
      }),
    ]);

    await service.applyTemplate("template-1", applyInput, "tenant-1", "user-1");

    expect(mockItemRepo.create).toHaveBeenCalledTimes(2);
    expect(mockItemRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        planningId: "planning-1",
        tenantId: "tenant-1",
        name: "Kabel Fiber 24 Core",
        quantity: 100,
        unit: "meter",
        estimatedPrice: 50_000,
      }),
    );
    expect(mockItemRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Closure 24 Core",
        quantity: 4,
        estimatedPrice: 750_000,
      }),
    );
  });

  it("mengembalikan item yang tersalin di DTO, bukan daftar kosong", async () => {
    mockTemplateItemRepo.findByTemplateId.mockResolvedValue([
      templateItem({ id: "ti-1", name: "Kabel Fiber 24 Core" }),
      templateItem({ id: "ti-2", name: "Closure 24 Core" }),
    ]);

    const result = await service.applyTemplate(
      "template-1",
      applyInput,
      "tenant-1",
      "user-1",
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.name)).toEqual([
      "Kabel Fiber 24 Core",
      "Closure 24 Core",
    ]);
  });

  it("tidak menyalin apa pun bila template tidak punya item", async () => {
    mockTemplateItemRepo.findByTemplateId.mockResolvedValue([]);

    const result = await service.applyTemplate(
      "template-1",
      applyInput,
      "tenant-1",
      "user-1",
    );

    expect(mockItemRepo.create).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(0);
  });

  it("meneruskan estimatedUnits dari pemohon apa adanya", async () => {
    mockTemplateItemRepo.findByTemplateId.mockResolvedValue([]);

    await service.applyTemplate(
      "template-1",
      { ...applyInput, estimatedUnits: 250 },
      "tenant-1",
      "user-1",
    );

    expect(mockPlanningRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedUnits: 250 }),
    );
  });

  /**
   * Daftar template SELALU dibatasi tenantId sesi (app/api/planning/templates
   * /route.ts), termasuk untuk superadmin. Jadi menerapkan template milik tenant
   * lain bukan alur sah mana pun — hanya bisa dicapai dengan merakit request
   * berisi templateId tenant lain.
   *
   * Untuk pengguna tenant biasa, ekstensi isolasi Prisma sudah menyuntik
   * tenantId ke findFirst sehingga repo mengembalikan null. Yang tidak
   * terlindungi adalah superadmin: ekstensi sengaja tidak memfilter untuknya,
   * sehingga BOQ tenant lain — nama material, kuantitas, harga satuan — bisa
   * tersalin masuk ke tenant penerima.
   */
  it("menolak menerapkan template milik tenant lain", async () => {
    mockTemplateRepo.findById.mockResolvedValue(
      new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-lain",
        name: "OSP Standar 100 Unit",
        description: null,
        type: "OSP",
        isActive: true,
        createdById: "user-9",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    mockTemplateItemRepo.findByTemplateId.mockResolvedValue([
      templateItem({ id: "ti-1", tenantId: "tenant-lain" }),
    ]);

    await expect(
      service.applyTemplate("template-1", applyInput, "tenant-1", "user-1"),
    ).rejects.toThrow(/not found/i);

    expect(mockPlanningRepo.create).not.toHaveBeenCalled();
    expect(mockItemRepo.create).not.toHaveBeenCalled();
  });
});
