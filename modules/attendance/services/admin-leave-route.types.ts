import type { Session } from "next-auth";

export type LeaveStatusValue = string;
export type LeaveTypeValue = string;

export type LeaveScopeTarget = {
  siteId: string | null;
  departmentId: string | null;
};

export type AccessContext = {
  permissions: string[];
  currentUser: {
    siteId?: string | null;
    departmentId?: string | null;
  };
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
