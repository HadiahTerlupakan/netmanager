import type { Prisma } from "@prisma/client";
import { assertApproverIsDistinct } from "../domain/planning-business-rules";
import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "../domain/ports/IPlanningItemRepository";
import type { IPlanningMilestoneRepository } from "../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningDocumentRepository } from "../domain/ports/IPlanningDocumentRepository";
import type { PlanningDetailDTO } from "../dto/PlanningDTO";
import { PlanningMapper } from "../mappers/PlanningMapper";
import { PlanningAuditService } from "./PlanningAuditService";
import { logger } from "@/lib/logger";

type PrismaTransaction = Prisma.TransactionClient;

/**
 * PlanningApprovalService
 * Service untuk mengelola workflow approval multi-level planning.
 * Logika budget threshold dan transisi status approval.
 */
export class PlanningApprovalService {
  private readonly BUDGET_THRESHOLD = 500_000_000; // Rp 500M

  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly itemRepo: IPlanningItemRepository,
    private readonly milestoneRepo: IPlanningMilestoneRepository,
    private readonly documentRepo: IPlanningDocumentRepository,
    private readonly auditService: PlanningAuditService,
  ) {}

  /**
   * Determine approval level berdasarkan budget threshold
   */
  private determineApprovalLevel(estimatedBudget: number | null): number {
    if (!estimatedBudget) return 1;
    return estimatedBudget >= this.BUDGET_THRESHOLD ? 2 : 1;
  }

  /**
   * Submit planning untuk approval
   * Status: BACKLOG/REJECTED → PENDING_APPROVAL
   */
  async submit(id: string, userId: string): Promise<PlanningDetailDTO> {
    const planning = await this.planningRepo.findById(id);
    if (!planning) {
      throw new Error(`Planning with ID ${id} not found`);
    }

    // Validasi: planning harus bisa disubmit
    if (!planning.canBeSubmitted()) {
      throw new Error(
        `Planning cannot be submitted in status ${planning.status}. Only BACKLOG or REJECTED status can be submitted.`,
      );
    }

    // Determine approval level based on budget
    const approvalLevel = this.determineApprovalLevel(planning.estimatedBudget);

    // Update status ke PENDING_APPROVAL
    const updatedEntity = await this.planningRepo.updateStatus(id, {
      status: "PENDING_APPROVAL",
      submittedAt: new Date(),
      submittedById: userId,
      currentApprovalStep: 0,
      approvalLevel,
    });

    // Audit log
    await this.auditService.logChange(
      id,
      "SUBMITTED",
      userId,
      {
        status: { from: planning.status, to: "PENDING_APPROVAL" },
        approvalLevel,
      },
      `Planning submitted for approval (level ${approvalLevel})`,
    );

    // Activity log
    logger.logActivity({
      action: "planning.submitted",
      subject: "Planning",
      details: {
        planningId: id,
        title: planning.title,
        estimatedBudget: planning.estimatedBudget,
        approvalLevel,
      },
      userId,
      tenantId: planning.tenantId,
    });

    // Load relations
    const items = await this.itemRepo.findByPlanningId(id);
    const milestones = await this.milestoneRepo.findByPlanningId(id);
    const documents = await this.documentRepo.findByPlanningId(id);

    return PlanningMapper.toDetailDTO(updatedEntity, {
      items,
      milestones,
      documents,
    });
  }

  /**
   * Approve planning (single-level atau multi-level)
   * - Level 1 approval: PENDING_APPROVAL → APPROVED (jika approvalLevel = 1)
   * - Level 1 approval: PENDING_APPROVAL → APPROVED_LEVEL1 (jika approvalLevel = 2)
   * - Level 2 approval: APPROVED_LEVEL1 → APPROVED (jika approvalLevel = 2)
   */
  async approve(
    id: string,
    userId: string,
    notes?: string | null,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.planningRepo.findById(id);
    if (!planning) {
      throw new Error(`Planning with ID ${id} not found`);
    }

    // Validasi: planning harus bisa diapprove
    if (!planning.canBeApproved()) {
      throw new Error(
        `Planning cannot be approved in status ${planning.status}. Only PENDING_APPROVAL or APPROVED_LEVEL1 status can be approved.`,
      );
    }

    // Persetujuan tingkat kedua wajib oleh orang yang berbeda; tanpa ini alur
    // berlapis tidak memberi kendali apa pun.
    assertApproverIsDistinct({
      approverId: userId,
      approvedLevel1ById: planning.approvedLevel1ById,
    });

    let updatedEntity;

    if (planning.approvalLevel === 1) {
      // Single-level approval: PENDING_APPROVAL → APPROVED
      updatedEntity = await this.planningRepo.updateStatus(id, {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: userId,
        currentApprovalStep: 1,
        approvalNotes: notes ?? null,
      });

      await this.auditService.logChange(
        id,
        "APPROVED",
        userId,
        {
          status: { from: planning.status, to: "APPROVED" },
          level: 1,
        },
        notes ?? "Planning approved",
      );

      logger.logActivity({
        action: "planning.approved",
        subject: "Planning",
        details: {
          planningId: id,
          title: planning.title,
          approvalLevel: 1,
          notes,
        },
        userId,
        tenantId: planning.tenantId,
      });
    } else if (planning.approvalLevel === 2) {
      if (planning.currentApprovalStep === 0) {
        // First approval (level 1): PENDING_APPROVAL → APPROVED_LEVEL1
        updatedEntity = await this.planningRepo.updateStatus(id, {
          status: "APPROVED_LEVEL1",
          approvedLevel1At: new Date(),
          approvedLevel1ById: userId,
          currentApprovalStep: 1,
        });

        await this.auditService.logChange(
          id,
          "APPROVED",
          userId,
          {
            status: { from: planning.status, to: "APPROVED_LEVEL1" },
            level: 1,
          },
          notes ?? "Planning approved at level 1, waiting for level 2 approval",
        );

        logger.logActivity({
          action: "planning.approved_level1",
          subject: "Planning",
          details: {
            planningId: id,
            title: planning.title,
            approvalLevel: 2,
            currentStep: 1,
            notes,
          },
          userId,
          tenantId: planning.tenantId,
        });
      } else {
        // Final approval (level 2): APPROVED_LEVEL1 → APPROVED
        updatedEntity = await this.planningRepo.updateStatus(id, {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: userId,
          currentApprovalStep: 2,
          approvalNotes: notes ?? null,
        });

        await this.auditService.logChange(
          id,
          "APPROVED",
          userId,
          {
            status: { from: planning.status, to: "APPROVED" },
            level: 2,
          },
          notes ?? "Planning fully approved at level 2",
        );

        logger.logActivity({
          action: "planning.approved_final",
          subject: "Planning",
          details: {
            planningId: id,
            title: planning.title,
            approvalLevel: 2,
            currentStep: 2,
            notes,
          },
          userId,
          tenantId: planning.tenantId,
        });
      }
    } else {
      throw new Error(
        `Invalid approval level ${planning.approvalLevel} for planning ${id}`,
      );
    }

    // Load relations
    const items = await this.itemRepo.findByPlanningId(id);
    const milestones = await this.milestoneRepo.findByPlanningId(id);
    const documents = await this.documentRepo.findByPlanningId(id);

    return PlanningMapper.toDetailDTO(updatedEntity, {
      items,
      milestones,
      documents,
    });
  }

  /**
   * Reject planning
   * Status: PENDING_APPROVAL/APPROVED_LEVEL1 → REJECTED
   */
  async reject(
    id: string,
    userId: string,
    notes: string,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.planningRepo.findById(id);
    if (!planning) {
      throw new Error(`Planning with ID ${id} not found`);
    }

    // Validasi: planning harus bisa direject
    if (!planning.canBeRejected()) {
      throw new Error(
        `Planning cannot be rejected in status ${planning.status}. Only PENDING_APPROVAL or APPROVED_LEVEL1 status can be rejected.`,
      );
    }

    // Validasi: notes wajib untuk reject
    if (!notes || notes.trim() === "") {
      throw new Error("Rejection notes are required");
    }

    // Update status ke REJECTED
    const updatedEntity = await this.planningRepo.updateStatus(id, {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedById: userId,
      approvalNotes: notes,
    });

    // Audit log
    await this.auditService.logChange(
      id,
      "REJECTED",
      userId,
      {
        status: { from: planning.status, to: "REJECTED" },
        rejectionLevel:
          planning.currentApprovalStep === 0 ? 1 : planning.currentApprovalStep,
      },
      notes,
    );

    // Activity log
    logger.logActivity({
      action: "planning.rejected",
      subject: "Planning",
      details: {
        planningId: id,
        title: planning.title,
        notes,
        rejectionLevel:
          planning.currentApprovalStep === 0 ? 1 : planning.currentApprovalStep,
      },
      userId,
      tenantId: planning.tenantId,
    });

    // Load relations
    const items = await this.itemRepo.findByPlanningId(id);
    const milestones = await this.milestoneRepo.findByPlanningId(id);
    const documents = await this.documentRepo.findByPlanningId(id);

    return PlanningMapper.toDetailDTO(updatedEntity, {
      items,
      milestones,
      documents,
    });
  }

  /**
   * Cancel planning
   * Status: any (except COMPLETED, CANCELLED, REJECTED) → CANCELLED
   */
  async cancel(
    id: string,
    userId: string,
    notes: string,
  ): Promise<PlanningDetailDTO> {
    const planning = await this.planningRepo.findById(id);
    if (!planning) {
      throw new Error(`Planning with ID ${id} not found`);
    }

    // Validasi: planning harus bisa dicancel
    if (!planning.canBeCancelled()) {
      throw new Error(
        `Planning cannot be cancelled in status ${planning.status}. COMPLETED, CANCELLED, or REJECTED status cannot be cancelled.`,
      );
    }

    // Validasi: notes wajib untuk cancel
    if (!notes || notes.trim() === "") {
      throw new Error("Cancellation notes are required");
    }

    // Update status ke CANCELLED
    const updatedEntity = await this.planningRepo.updateStatus(id, {
      status: "CANCELLED",
      approvalNotes: notes,
    });

    // Audit log
    await this.auditService.logChange(
      id,
      "CANCELLED",
      userId,
      {
        status: { from: planning.status, to: "CANCELLED" },
      },
      notes,
    );

    // Activity log
    logger.logActivity({
      action: "planning.cancelled",
      subject: "Planning",
      details: {
        planningId: id,
        title: planning.title,
        notes,
      },
      userId,
      tenantId: planning.tenantId,
    });

    // Load relations
    const items = await this.itemRepo.findByPlanningId(id);
    const milestones = await this.milestoneRepo.findByPlanningId(id);
    const documents = await this.documentRepo.findByPlanningId(id);

    return PlanningMapper.toDetailDTO(updatedEntity, {
      items,
      milestones,
      documents,
    });
  }
}
