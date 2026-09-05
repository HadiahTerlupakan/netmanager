import {
  isApproverDistinct,
  resolveApprovalBaseBudget,
  resolveApprovalLevel,
  sumItemsEstimatedCost,
} from "../domain/planning-business-rules";
import type {
  IPlanningRepository,
  UpdateStatusInput,
} from "../domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "../domain/ports/IPlanningItemRepository";
import type { IPlanningMilestoneRepository } from "../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningDocumentRepository } from "../domain/ports/IPlanningDocumentRepository";
import type { IPlanningUnitOfWork } from "../domain/ports/IPlanningUnitOfWork";
import type { PlanningDetailDTO } from "../dto/PlanningDTO";
import type { PlanningEntity } from "../domain/entities/PlanningEntity";
import type { AuditAction } from "../domain/entities/PlanningAuditLogEntity";
import { PlanningMapper } from "../mappers/PlanningMapper";
import { PlanningAuditService } from "./PlanningAuditService";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
  PlanningSegregationOfDutiesError,
  PlanningValidationError,
} from "../errors/planning-errors";
import { logger } from "@/lib/logger";

/**
 * Satu transisi status beserta jejak yang menyertainya.
 * Dipakai `applyTransition` supaya tiga cabang persetujuan tidak lagi
 * mengulang blok update + audit + activity log yang hampir identik.
 */
interface PlanningTransition {
  planning: PlanningEntity;
  updates: UpdateStatusInput;
  auditAction: AuditAction;
  auditChanges: Record<string, unknown>;
  auditNotes?: string | null;
  activityAction: string;
  activityDetails?: Record<string, unknown>;
  userId: string;
}

/**
 * PlanningApprovalService
 * Service untuk mengelola workflow approval multi-level planning.
 */
export class PlanningApprovalService {
  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly itemRepo: IPlanningItemRepository,
    private readonly milestoneRepo: IPlanningMilestoneRepository,
    private readonly documentRepo: IPlanningDocumentRepository,
    private readonly auditService: PlanningAuditService,
    private readonly unitOfWork: IPlanningUnitOfWork,
  ) {}

  /**
   * Mengambil rencana milik tenant pemanggil, atau melempar bila tidak ada.
   *
   * Ekstensi isolasi Prisma sengaja melewatkan super admin, sehingga tanpa
   * guard eksplisit sesi super admin di panel tenant A bisa menyetujui rencana
   * belanja tenant B hanya dengan menebak ID-nya. Pesan disamakan dengan kasus
   * tidak ditemukan supaya keberadaan rencana tenant lain tidak terkonfirmasi.
   */
  private async findOwnedPlanning(
    id: string,
    tenantId: string,
  ): Promise<PlanningEntity> {
    const planning = await this.planningRepo.findById(id);

    if (!planning || planning.tenantId !== tenantId) {
      throw new PlanningNotFoundError();
    }

    return planning;
  }

  /** Merakit DTO detail beserta relasinya. */
  private async buildDetailDTO(
    id: string,
    entity: PlanningEntity,
  ): Promise<PlanningDetailDTO> {
    const [items, milestones, documents] = await Promise.all([
      this.itemRepo.findByPlanningId(id),
      this.milestoneRepo.findByPlanningId(id),
      this.documentRepo.findByPlanningId(id),
    ]);

    return PlanningMapper.toDetailDTO(entity, { items, milestones, documents });
  }

  /**
   * Menerapkan satu transisi status: tulis status, tulis audit, catat aktivitas.
   *
   * Status dan auditnya ditulis dalam satu transaksi supaya tidak mungkin ada
   * rencana yang statusnya berubah tanpa jejak siapa yang mengubahnya —
   * kondisi yang sebelumnya terjadi setiap kali penulisan audit gagal.
   * `expectedStatus` diisi dari status yang dibaca, sehingga transisi bersamaan
   * ditolak sebagai konflik alih-alih saling menimpa.
   */
  private async applyTransition(
    transition: PlanningTransition,
  ): Promise<PlanningEntity> {
    const { planning, updates, userId } = transition;

    const updatedEntity = await this.unitOfWork.runInTransaction(async (tx) => {
      const updated = await this.planningRepo.updateStatus(
        planning.id,
        { ...updates, expectedStatus: planning.status },
        tx,
      );

      await this.auditService.logChange(
        {
          planningId: planning.id,
          tenantId: planning.tenantId,
          action: transition.auditAction,
          performedById: userId,
          changes: transition.auditChanges,
          notes: transition.auditNotes ?? null,
        },
        tx,
      );

      return updated;
    });

    logger.logActivity({
      action: transition.activityAction,
      subject: "Planning",
      details: {
        planningId: planning.id,
        title: planning.title,
        ...transition.activityDetails,
      },
      userId,
      tenantId: planning.tenantId,
    });

    return updatedEntity;
  }

  /**
   * Menghitung tingkat persetujuan yang dibutuhkan saat rencana diajukan.
   *
   * Dihitung ulang dari BOQ, bukan hanya dari anggaran header. `estimatedBudget`
   * ditetapkan saat rencana dibuat, sedangkan item BOQ masih boleh ditambah
   * selama status BACKLOG — rencana dengan header Rp 100 juta yang kemudian
   * diisi BOQ Rp 900 juta sebelumnya tetap diajukan sebagai satu tingkat, dan
   * satu orang bisa menyetujui belanja yang menurut aturan butuh dua.
   */
  private async resolveApprovalLevelForSubmission(
    planning: PlanningEntity,
  ): Promise<{ approvalLevel: number; baseBudget: number | null }> {
    const items = await this.itemRepo.findByPlanningId(planning.id);
    const baseBudget = resolveApprovalBaseBudget({
      estimatedBudget: planning.estimatedBudget,
      itemsTotalCost: sumItemsEstimatedCost(items),
    });

    return { approvalLevel: resolveApprovalLevel(baseBudget), baseBudget };
  }

  /**
   * Submit planning untuk approval.
   * Status: BACKLOG/REJECTED → PENDING_APPROVAL
   */
  async submit(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.findOwnedPlanning(id, tenantId);

    if (!planning.canBeSubmitted()) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${planning.status} tidak bisa diajukan. Hanya rencana berstatus BACKLOG atau REJECTED yang bisa diajukan.`,
      );
    }

    const { approvalLevel, baseBudget } =
      await this.resolveApprovalLevelForSubmission(planning);

    const updatedEntity = await this.applyTransition({
      planning,
      userId,
      updates: {
        status: "PENDING_APPROVAL",
        submittedAt: new Date(),
        submittedById: userId,
        currentApprovalStep: 0,
        approvalLevel,
        // Jejak siklus persetujuan sebelumnya dibersihkan.
        //
        // Rencana yang ditolak boleh diajukan ulang, tetapi field lama ikut
        // terbawa. Akibatnya konkret: penyetuju tingkat 1 di siklus lama
        // tersangkut di `approvedLevel1ById`, sehingga saat ia menyetujui di
        // siklus baru pemeriksaan penyetuju menolaknya sebagai orang yang
        // sama — ia terkunci permanen dari rencana itu. Halaman detail juga
        // menampilkan "Disetujui oleh X" pada rencana yang statusnya masih
        // menunggu persetujuan.
        approvedAt: null,
        approvedById: null,
        approvedLevel1At: null,
        approvedLevel1ById: null,
        rejectedAt: null,
        rejectedById: null,
        approvalNotes: null,
      },
      auditAction: "SUBMITTED",
      auditChanges: {
        status: { from: planning.status, to: "PENDING_APPROVAL" },
        approvalLevel,
        approvalBaseBudget: baseBudget,
      },
      auditNotes: `Planning submitted for approval (level ${approvalLevel})`,
      activityAction: "planning.submitted",
      activityDetails: {
        estimatedBudget: planning.estimatedBudget,
        approvalBaseBudget: baseBudget,
        approvalLevel,
      },
    });

    return this.buildDetailDTO(id, updatedEntity);
  }

  /**
   * Approve planning (single-level atau multi-level)
   * - approvalLevel 1: PENDING_APPROVAL → APPROVED
   * - approvalLevel 2, langkah 1: PENDING_APPROVAL → APPROVED_LEVEL1
   * - approvalLevel 2, langkah 2: APPROVED_LEVEL1 → APPROVED
   */
  async approve(
    id: string,
    userId: string,
    tenantId: string,
    notes?: string | null,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.findOwnedPlanning(id, tenantId);

    if (!planning.canBeApproved()) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${planning.status} tidak bisa disetujui. Hanya rencana berstatus PENDING_APPROVAL atau APPROVED_LEVEL1 yang bisa disetujui.`,
      );
    }

    // Persetujuan tingkat kedua wajib oleh orang yang berbeda; tanpa ini alur
    // berlapis tidak memberi kendali apa pun.
    if (
      !isApproverDistinct({
        approverId: userId,
        approvedLevel1ById: planning.approvedLevel1ById,
      })
    ) {
      throw new PlanningSegregationOfDutiesError();
    }

    const transition = this.resolveApprovalTransition(planning, userId, notes);
    const updatedEntity = await this.applyTransition(transition);

    return this.buildDetailDTO(id, updatedEntity);
  }

  /**
   * Menentukan bentuk transisi untuk satu penekanan tombol Setujui.
   *
   * Dipisahkan dari `approve()` supaya percabangan tingkat persetujuan berdiri
   * sendiri dari penulisan status, audit, dan activity log.
   */
  private resolveApprovalTransition(
    planning: PlanningEntity,
    userId: string,
    notes?: string | null,
  ): PlanningTransition {
    const isFinalApproval =
      planning.approvalLevel === 1 || planning.currentApprovalStep > 0;

    if (planning.approvalLevel !== 1 && planning.approvalLevel !== 2) {
      throw new PlanningInvalidStateError(
        `Tingkat persetujuan ${planning.approvalLevel} tidak dikenali untuk rencana ${planning.id}.`,
      );
    }

    if (!isFinalApproval) {
      // Persetujuan pertama dari dua: PENDING_APPROVAL → APPROVED_LEVEL1
      return {
        planning,
        userId,
        updates: {
          status: "APPROVED_LEVEL1",
          approvedLevel1At: new Date(),
          approvedLevel1ById: userId,
          currentApprovalStep: 1,
        },
        auditAction: "APPROVED",
        auditChanges: {
          status: { from: planning.status, to: "APPROVED_LEVEL1" },
          level: 1,
        },
        auditNotes:
          notes ?? "Planning approved at level 1, waiting for level 2 approval",
        activityAction: "planning.approved_level1",
        activityDetails: { approvalLevel: 2, currentStep: 1, notes },
      };
    }

    const approvalStep = planning.approvalLevel === 1 ? 1 : 2;

    return {
      planning,
      userId,
      updates: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: userId,
        currentApprovalStep: approvalStep,
        approvalNotes: notes ?? null,
      },
      auditAction: "APPROVED",
      auditChanges: {
        status: { from: planning.status, to: "APPROVED" },
        level: approvalStep,
      },
      auditNotes:
        notes ??
        (planning.approvalLevel === 1
          ? "Planning approved"
          : "Planning fully approved at level 2"),
      activityAction:
        planning.approvalLevel === 1
          ? "planning.approved"
          : "planning.approved_final",
      activityDetails: {
        approvalLevel: planning.approvalLevel,
        currentStep: approvalStep,
        notes,
      },
    };
  }

  /**
   * Reject planning
   * Status: PENDING_APPROVAL/APPROVED_LEVEL1 → REJECTED
   */
  async reject(
    id: string,
    userId: string,
    tenantId: string,
    notes: string,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.findOwnedPlanning(id, tenantId);

    if (!planning.canBeRejected()) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${planning.status} tidak bisa ditolak. Hanya rencana berstatus PENDING_APPROVAL atau APPROVED_LEVEL1 yang bisa ditolak.`,
      );
    }

    if (!notes || notes.trim() === "") {
      throw new PlanningValidationError("Alasan penolakan wajib diisi.");
    }

    const rejectionLevel =
      planning.currentApprovalStep === 0 ? 1 : planning.currentApprovalStep;

    const updatedEntity = await this.applyTransition({
      planning,
      userId,
      updates: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedById: userId,
        approvalNotes: notes,
      },
      auditAction: "REJECTED",
      auditChanges: {
        status: { from: planning.status, to: "REJECTED" },
        rejectionLevel,
      },
      auditNotes: notes,
      activityAction: "planning.rejected",
      activityDetails: { notes, rejectionLevel },
    });

    return this.buildDetailDTO(id, updatedEntity);
  }

  /**
   * Memulai pelaksanaan: APPROVED → IN_PROGRESS.
   *
   * Sebelumnya tidak ada apa pun yang memindahkan rencana keluar dari APPROVED,
   * sehingga kolom Kanban "In Progress" dan "Completed" mustahil terisi padahal
   * ditampilkan.
   */
  async startProgress(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.findOwnedPlanning(id, tenantId);

    if (!planning.canStartProgress()) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${planning.status} tidak bisa dimulai. Hanya rencana berstatus APPROVED yang bisa dimulai.`,
      );
    }

    const updatedEntity = await this.applyTransition({
      planning,
      userId,
      updates: {
        status: "IN_PROGRESS",
        startDate: planning.startDate ?? new Date(),
      },
      auditAction: "STATUS_CHANGED",
      auditChanges: { status: { from: planning.status, to: "IN_PROGRESS" } },
      activityAction: "planning.started",
    });

    return this.buildDetailDTO(id, updatedEntity);
  }

  /**
   * Menutup pelaksanaan: IN_PROGRESS → COMPLETED.
   * Progres dikunci ke 100 dan tanggal penyelesaian dicatat, supaya rencana
   * yang selesai tidak lagi menampilkan progres separuh jalan.
   */
  async complete(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.findOwnedPlanning(id, tenantId);

    if (!planning.isInProgress()) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${planning.status} tidak bisa diselesaikan. Hanya rencana berstatus IN_PROGRESS yang bisa diselesaikan.`,
      );
    }

    const updatedEntity = await this.applyTransition({
      planning,
      userId,
      updates: {
        status: "COMPLETED",
        actualCompletionDate: new Date(),
        progressPercentage: 100,
      },
      auditAction: "STATUS_CHANGED",
      auditChanges: { status: { from: planning.status, to: "COMPLETED" } },
      activityAction: "planning.completed",
    });

    return this.buildDetailDTO(id, updatedEntity);
  }

  /**
   * Cancel planning
   * Status: apa pun kecuali COMPLETED, CANCELLED, REJECTED → CANCELLED
   */
  async cancel(
    id: string,
    userId: string,
    tenantId: string,
    notes: string,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.findOwnedPlanning(id, tenantId);

    if (!planning.canBeCancelled()) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${planning.status} tidak bisa dibatalkan. Rencana berstatus COMPLETED, CANCELLED, atau REJECTED tidak bisa dibatalkan.`,
      );
    }

    if (!notes || notes.trim() === "") {
      throw new PlanningValidationError("Alasan pembatalan wajib diisi.");
    }

    const updatedEntity = await this.applyTransition({
      planning,
      userId,
      updates: {
        status: "CANCELLED",
        approvalNotes: notes,
      },
      auditAction: "CANCELLED",
      auditChanges: { status: { from: planning.status, to: "CANCELLED" } },
      auditNotes: notes,
      activityAction: "planning.cancelled",
      activityDetails: { notes },
    });

    return this.buildDetailDTO(id, updatedEntity);
  }
}
