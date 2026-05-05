import { RabRevisionStatus } from "../types/invoice.enums";
import { DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD } from "../utils/rab-revisions";

type RevisionApproval = { status: string; userId: string };
type ApprovalRevision = {
  approvals: RevisionApproval[];
  notes?: string | null;
};

export function buildRejectApprovalRecord(
  revisionId: string,
  options: { userId: string; notes?: string },
) {
  return {
    where: {
      rabRevisionId_userId: {
        rabRevisionId: revisionId,
        userId: options.userId,
      },
    },
    create: {
      rabRevisionId: revisionId,
      userId: options.userId,
      status: "REJECTED",
      notes: options.notes,
    },
    update: {
      status: "REJECTED",
      notes: options.notes,
    },
  };
}

export function buildRejectedRevisionData(
  revision: { notes?: string | null },
  options: { userId: string; notes?: string },
) {
  return {
    status: RabRevisionStatus.REJECTED,
    notes: options.notes ?? revision.notes,
    rejectedById: options.userId,
    rejectedAt: new Date(),
  };
}

export function hasReachedApprovalThreshold(approvals: RevisionApproval[]) {
  return getApprovedCount(approvals) >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD;
}

export function getApprovalMessage(approvalCount: number) {
  return approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD
    ? "Revisi RAB berhasil disetujui seutuhnya."
    : "Persetujuan revisi dicatat.";
}

export function getApprovedCount(approvals: RevisionApproval[]) {
  return approvals.filter((approval) => approval.status === "APPROVED").length;
}

export function buildPromotedRevisionData(revision: ApprovalRevision) {
  return {
    status: RabRevisionStatus.APPROVED,
    approvedById: getFirstApprovedUserId(revision),
    approvedAt: new Date(),
  };
}

export function buildRevisionStatusUpdate(
  nextStatus: RabRevisionStatus,
  approvalCount: number,
  userId: string,
) {
  return {
    status: nextStatus,
    approvedById: hasApprovalThreshold(approvalCount) ? userId : undefined,
    approvedAt: hasApprovalThreshold(approvalCount) ? new Date() : undefined,
  };
}

function getFirstApprovedUserId(revision: ApprovalRevision) {
  return revision.approvals.find((approval) => approval.status === "APPROVED")
    ?.userId;
}

function hasApprovalThreshold(approvalCount: number) {
  return approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD;
}
