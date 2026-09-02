export type PlanningType = "OSP";

export type PlanningStatus =
  | "BACKLOG"
  | "PENDING_APPROVAL"
  | "APPROVED_LEVEL1"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PlanningEntityProps {
  id: string;
  tenantId: string;
  type: PlanningType;
  title: string;
  description: string | null;
  area: string;
  coordinates: Coordinates | null;
  estimatedUnits: number;
  estimatedBudget: number | null;
  actualBudget: number | null;
  status: PlanningStatus;
  approvalLevel: number;
  currentApprovalStep: number;
  submittedAt: Date | null;
  submittedById: string | null;
  approvedAt: Date | null;
  approvedById: string | null;
  approvedLevel1At: Date | null;
  approvedLevel1ById: string | null;
  rejectedAt: Date | null;
  rejectedById: string | null;
  approvalNotes: string | null;
  progressPercentage: number;
  startDate: Date | null;
  targetCompletionDate: Date | null;
  actualCompletionDate: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * PlanningEntity represents a planning document (e.g., OSP - Outside Plant Planning)
 * with multi-level approval workflow and project tracking capabilities.
 */
export class PlanningEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly type: PlanningType;
  readonly title: string;
  readonly description: string | null;
  readonly area: string;
  readonly coordinates: Coordinates | null;
  readonly estimatedUnits: number;
  readonly estimatedBudget: number | null;
  readonly actualBudget: number | null;
  readonly status: PlanningStatus;
  readonly approvalLevel: number;
  readonly currentApprovalStep: number;
  readonly submittedAt: Date | null;
  readonly submittedById: string | null;
  readonly approvedAt: Date | null;
  readonly approvedById: string | null;
  readonly approvedLevel1At: Date | null;
  readonly approvedLevel1ById: string | null;
  readonly rejectedAt: Date | null;
  readonly rejectedById: string | null;
  readonly approvalNotes: string | null;
  readonly progressPercentage: number;
  readonly startDate: Date | null;
  readonly targetCompletionDate: Date | null;
  readonly actualCompletionDate: Date | null;
  readonly createdById: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: PlanningEntityProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.type = props.type;
    this.title = props.title;
    this.description = props.description;
    this.area = props.area;
    this.coordinates = props.coordinates;
    this.estimatedUnits = props.estimatedUnits;
    this.estimatedBudget = props.estimatedBudget;
    this.actualBudget = props.actualBudget;
    this.status = props.status;
    this.approvalLevel = props.approvalLevel;
    this.currentApprovalStep = props.currentApprovalStep;
    this.submittedAt = props.submittedAt;
    this.submittedById = props.submittedById;
    this.approvedAt = props.approvedAt;
    this.approvedById = props.approvedById;
    this.approvedLevel1At = props.approvedLevel1At;
    this.approvedLevel1ById = props.approvedLevel1ById;
    this.rejectedAt = props.rejectedAt;
    this.rejectedById = props.rejectedById;
    this.approvalNotes = props.approvalNotes;
    this.progressPercentage = props.progressPercentage;
    this.startDate = props.startDate;
    this.targetCompletionDate = props.targetCompletionDate;
    this.actualCompletionDate = props.actualCompletionDate;
    this.createdById = props.createdById;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  // Status checks
  isApproved(): boolean {
    return this.status === "APPROVED";
  }

  isPendingApproval(): boolean {
    return this.status === "PENDING_APPROVAL";
  }

  isCompleted(): boolean {
    return this.status === "COMPLETED";
  }

  isRejected(): boolean {
    return this.status === "REJECTED";
  }

  isInProgress(): boolean {
    return this.status === "IN_PROGRESS";
  }

  isCancelled(): boolean {
    return this.status === "CANCELLED";
  }

  isBacklog(): boolean {
    return this.status === "BACKLOG";
  }

  isApprovedLevel1(): boolean {
    return this.status === "APPROVED_LEVEL1";
  }

  // Approval workflow
  requiresSecondApproval(): boolean {
    return this.approvalLevel === 2 && this.currentApprovalStep === 1;
  }

  // Permission checks
  canBeEdited(): boolean {
    return this.status === "BACKLOG" || this.status === "REJECTED";
  }

  /**
   * Apakah realisasi pelaksanaan boleh dicatat (actualBudget, progressPercentage).
   *
   * Dipisahkan dari `canBeEdited()` dengan sengaja. Field perencanaan — ruang
   * lingkup, estimasi, anggaran rencana — tetap terkunci setelah disetujui,
   * karena mengubahnya akan membatalkan makna persetujuan. Tetapi realisasi
   * justru baru ada SETELAH pekerjaan berjalan; sebelumnya keduanya memakai
   * gerbang yang sama sehingga realisasi hanya bisa diisi saat BACKLOG —
   * ketika realisasi itu belum ada — lalu terkunci selamanya.
   */
  canRecordExecutionProgress(): boolean {
    return this.status === "IN_PROGRESS";
  }

  canBeSubmitted(): boolean {
    return this.status === "BACKLOG" || this.status === "REJECTED";
  }

  canBeApproved(): boolean {
    return (
      this.status === "PENDING_APPROVAL" || this.status === "APPROVED_LEVEL1"
    );
  }

  canBeRejected(): boolean {
    return (
      this.status === "PENDING_APPROVAL" || this.status === "APPROVED_LEVEL1"
    );
  }

  canBeCancelled(): boolean {
    return (
      this.status !== "COMPLETED" &&
      this.status !== "CANCELLED" &&
      this.status !== "REJECTED"
    );
  }

  canStartProgress(): boolean {
    return this.status === "APPROVED";
  }

  // Budget checks
  isOverBudget(): boolean {
    if (this.estimatedBudget === null || this.actualBudget === null) {
      return false;
    }
    return this.actualBudget > this.estimatedBudget;
  }

  getBudgetVariance(): number | null {
    if (this.estimatedBudget === null || this.actualBudget === null) {
      return null;
    }
    return this.actualBudget - this.estimatedBudget;
  }

  getBudgetVariancePercentage(): number | null {
    if (this.estimatedBudget === null || this.actualBudget === null) {
      return null;
    }
    if (this.estimatedBudget === 0) {
      return null;
    }
    return (
      ((this.actualBudget - this.estimatedBudget) / this.estimatedBudget) * 100
    );
  }

  // Date checks
  isOverdue(): boolean {
    if (!this.targetCompletionDate || this.actualCompletionDate) {
      return false;
    }
    return new Date() > this.targetCompletionDate;
  }

  // Soft delete check
  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
