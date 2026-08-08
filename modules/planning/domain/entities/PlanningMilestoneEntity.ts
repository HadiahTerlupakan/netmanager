export type MilestoneStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED";

export interface PlanningMilestoneEntityProps {
  id: string;
  planningId: string;
  tenantId: string;
  name: string;
  description: string | null;
  targetDate: Date;
  actualDate: Date | null;
  status: MilestoneStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PlanningMilestoneEntity represents a key milestone or checkpoint
 * in the planning project timeline.
 */
export class PlanningMilestoneEntity {
  readonly id: string;
  readonly planningId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string | null;
  readonly targetDate: Date;
  readonly actualDate: Date | null;
  readonly status: MilestoneStatus;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PlanningMilestoneEntityProps) {
    this.id = props.id;
    this.planningId = props.planningId;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.targetDate = props.targetDate;
    this.actualDate = props.actualDate;
    this.status = props.status;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  // Status checks
  isPending(): boolean {
    return this.status === "PENDING";
  }

  isInProgress(): boolean {
    return this.status === "IN_PROGRESS";
  }

  isCompleted(): boolean {
    return this.status === "COMPLETED";
  }

  isBlocked(): boolean {
    return this.status === "BLOCKED";
  }

  /**
   * Check if milestone is overdue (past target date and not completed)
   */
  isOverdue(): boolean {
    if (this.isCompleted() || this.actualDate !== null) {
      return false;
    }
    return new Date() > this.targetDate;
  }

  /**
   * Check if milestone was completed on time
   */
  wasCompletedOnTime(): boolean {
    if (!this.isCompleted() || this.actualDate === null) {
      return false;
    }
    return this.actualDate <= this.targetDate;
  }

  /**
   * Get delay in days (negative if completed early, positive if late)
   */
  getDelayInDays(): number | null {
    if (this.actualDate === null) {
      return null;
    }
    const diffMs = this.actualDate.getTime() - this.targetDate.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days remaining until target date (negative if overdue)
   */
  getDaysRemaining(): number {
    if (this.isCompleted()) {
      return 0;
    }
    const diffMs = this.targetDate.getTime() - new Date().getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if milestone can be marked as completed
   */
  canBeCompleted(): boolean {
    return this.status === "IN_PROGRESS" && !this.isBlocked();
  }
}
