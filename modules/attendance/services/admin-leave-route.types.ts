import type { Session } from "next-auth";
import type { AdminScope } from "./AdminScopeResolver";

export type LeaveStatusValue = string;
export type LeaveTypeValue = string;

export type LeaveScopeTarget = {
  siteId: string | null;
  departmentId: string | null;
};

export type AccessContext = {
  /** Lingkup admin; site-nya mencakup SELURUH site admin, bukan site utama. */
  scope: AdminScope;
  /** Dibatasi tetapi tanpa site/departemen: seluruh data di luar lingkup. */
  tanpaData: boolean;
};

export interface AdminLeaveSession {
  user: Session["user"] & {
    id: string;
    tenantId?: string | null;
  };
}

export interface AdminLeaveListInput {
  status?: LeaveStatusValue;
  tenantId: string;
  session: AdminLeaveSession;
  page?: number;
  limit?: number;
}

export interface AdminLeaveCreateInput {
  userId: string;
  type: LeaveTypeValue;
  startDate: Date;
  endDate: Date;
  reason: string;
  replacementDate?: Date;
  attachmentUrl?: string;
  session: AdminLeaveSession;
}

export interface AdminLeaveUpdateStatusInput {
  id: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
  session: AdminLeaveSession;
}

export interface AdminLeaveDeleteInput {
  id: string;
  session: AdminLeaveSession;
}
