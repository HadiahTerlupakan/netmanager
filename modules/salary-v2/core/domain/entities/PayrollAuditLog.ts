import type { AuditAction } from "../enums";

export type AuditEntityType =
  | "PAYROLL_RUN"
  | "PAYROLL_ENTRY"
  | "PAYROLL_LINE"
  | "CONFIG"
  | "COMPONENT"
  | "PROFILE";

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface PayrollAuditLog {
  id: string;
  tenantId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performedBy: string;
  timestamp: Date;
  changes: AuditChange[];
  reason: string | null;
  ipAddress: string | null;
}
