import type {
  PayrollAuditLog,
  AuditChange,
  AuditEntityType,
  AuditAction,
} from "@/modules/salary-v2/core";

// --- Types ---

export interface CreateAuditLogInput {
  tenantId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performedBy: string;
  changes: AuditChange[];
  reason?: string;
  ipAddress?: string;
}

export interface AuditLogFilter {
  tenantId: string;
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  performedBy?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** Port for persisting audit logs */
export interface IAuditLogRepository {
  create(log: PayrollAuditLog): Promise<PayrollAuditLog>;
  findAll(filter: AuditLogFilter): Promise<PayrollAuditLog[]>;
  findByEntityId(
    entityId: string,
    tenantId: string,
  ): Promise<PayrollAuditLog[]>;
}

/** Actions that require a reason */
const SENSITIVE_ACTIONS: AuditAction[] = [
  "UNLOCKED",
  "DELETED",
  "RECALCULATED",
];

// --- Service ---

/** Creates and queries audit trail entries for payroll operations */
export class PayrollAuditService {
  constructor(private readonly repository: IAuditLogRepository) {}

  /** Create an audit log entry */
  async log(input: CreateAuditLogInput): Promise<PayrollAuditLog> {
    // Validate reason for sensitive operations
    if (
      SENSITIVE_ACTIONS.includes(input.action) &&
      (!input.reason || input.reason.trim() === "")
    ) {
      throw new Error(
        `Reason is required for sensitive action: ${input.action}`,
      );
    }

    const auditLog: PayrollAuditLog = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      performedBy: input.performedBy,
      timestamp: new Date(),
      changes: input.changes,
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    };

    return this.repository.create(auditLog);
  }

  /** Compute field-level changes between old and new state */
  computeChanges<T extends Record<string, unknown>>(
    oldState: T,
    newState: T,
    fields?: (keyof T)[],
  ): AuditChange[] {
    const changes: AuditChange[] = [];
    const fieldsToCheck = fields ?? (Object.keys(newState) as (keyof T)[]);

    for (const field of fieldsToCheck) {
      const oldVal = oldState[field];
      const newVal = newState[field];

      if (!this.isEqual(oldVal, newVal)) {
        changes.push({
          field: String(field),
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }

    return changes;
  }

  /** Log a status change with computed changes */
  async logStatusChange(
    tenantId: string,
    entityType: AuditEntityType,
    entityId: string,
    oldStatus: string,
    newStatus: string,
    performedBy: string,
    reason?: string,
    ipAddress?: string,
  ): Promise<PayrollAuditLog> {
    return this.log({
      tenantId,
      entityType,
      entityId,
      action: "STATUS_CHANGED",
      performedBy,
      changes: [{ field: "status", oldValue: oldStatus, newValue: newStatus }],
      reason,
      ipAddress,
    });
  }

  /** Get audit history for a specific entity */
  async getEntityHistory(
    entityId: string,
    tenantId: string,
  ): Promise<PayrollAuditLog[]> {
    return this.repository.findByEntityId(entityId, tenantId);
  }

  /** Query audit logs with filters */
  async query(filter: AuditLogFilter): Promise<PayrollAuditLog[]> {
    return this.repository.findAll(filter);
  }

  /** Simple deep equality check for audit comparison */
  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (a === undefined || b === undefined) return a === b;

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    if (typeof a === "object" && typeof b === "object") {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }
}
