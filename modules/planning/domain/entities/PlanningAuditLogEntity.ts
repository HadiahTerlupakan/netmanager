export type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "STATUS_CHANGED"
  | "ITEM_ADDED"
  | "ITEM_REMOVED"
  | "ITEM_UPDATED"
  | "MILESTONE_UPDATED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DELETED";

export interface PlanningAuditLogEntityProps {
  id: string;
  planningId: string;
  tenantId: string;
  action: AuditAction;
  performedById: string | null;
  performedAt: Date;
  changes: Record<string, unknown> | null;
  notes: string | null;
}

/**
 * PlanningAuditLogEntity represents an audit trail entry for tracking
 * all changes made to a planning record for compliance and transparency.
 */
export class PlanningAuditLogEntity {
  readonly id: string;
  readonly planningId: string;
  readonly tenantId: string;
  readonly action: AuditAction;
  readonly performedById: string | null;
  readonly performedAt: Date;
  readonly changes: Record<string, unknown> | null;
  readonly notes: string | null;

  constructor(props: PlanningAuditLogEntityProps) {
    this.id = props.id;
    this.planningId = props.planningId;
    this.tenantId = props.tenantId;
    this.action = props.action;
    this.performedById = props.performedById;
    this.performedAt = props.performedAt;
    this.changes = props.changes;
    this.notes = props.notes;
  }

  // Action type checks
  isCreationAction(): boolean {
    return this.action === "CREATED";
  }

  isUpdateAction(): boolean {
    return this.action === "UPDATED";
  }

  isSubmissionAction(): boolean {
    return this.action === "SUBMITTED";
  }

  isApprovalAction(): boolean {
    return this.action === "APPROVED";
  }

  isRejectionAction(): boolean {
    return this.action === "REJECTED";
  }

  isCancellationAction(): boolean {
    return this.action === "CANCELLED";
  }

  isStatusChangeAction(): boolean {
    return this.action === "STATUS_CHANGED";
  }

  isItemAction(): boolean {
    return (
      this.action === "ITEM_ADDED" ||
      this.action === "ITEM_REMOVED" ||
      this.action === "ITEM_UPDATED"
    );
  }

  isMilestoneAction(): boolean {
    return this.action === "MILESTONE_UPDATED";
  }

  isDocumentAction(): boolean {
    return (
      this.action === "DOCUMENT_UPLOADED" || this.action === "DOCUMENT_DELETED"
    );
  }

  /**
   * Check if action represents a critical workflow event
   */
  isCriticalAction(): boolean {
    return (
      this.action === "SUBMITTED" ||
      this.action === "APPROVED" ||
      this.action === "REJECTED" ||
      this.action === "CANCELLED"
    );
  }

  /**
   * Check if action was performed by system (no performedById)
   */
  isSystemAction(): boolean {
    return this.performedById === null;
  }

  /**
   * Check if changes were recorded
   */
  hasChanges(): boolean {
    return this.changes !== null && Object.keys(this.changes).length > 0;
  }

  /**
   * Get specific change value by field name
   */
  getChangeValue(fieldName: string): unknown | undefined {
    if (!this.changes) {
      return undefined;
    }
    return this.changes[fieldName];
  }
}
