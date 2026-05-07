import { RabRevisionStatus } from "../types/invoice.enums";
import { prisma } from "@/modules/database";
import { isSuperAdminRole } from "@/lib/auth";
import {
  DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD,
  getRevisionApprovalStatus,
} from "../utils/rab-revisions";
import {
  buildPromotedRevisionData,
  buildRejectApprovalRecord,
  buildRejectedRevisionData,
  buildRevisionStatusUpdate,
  getApprovalMessage,
  hasReachedApprovalThreshold,
} from "./rab-revision-approval.helpers";

type RevisionRecord = Awaited<ReturnType<typeof findRevision>>;
type ApprovalTx = Parameters<typeof prisma.$transaction>[0] extends (
  arg: infer T,
) => Promise<unknown>
  ? T
  : never;

export class RabRevisionApprovalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type RabRevisionApprovalResult = {
  message: string;
  data: unknown;
};

/** Rejects a pending RAB revision as an authorized approver. */
export async function rejectRabRevision(options: {
  rabProjectId: string;
  revisionId: string;
  userId: string;
  notes?: string;
}) {
  await assertUserCanApproveRab(options.userId);
  const revision = await findRejectableRevision(options);
  return prisma.$transaction((tx) =>
    rejectRevisionInTransaction(tx, revision, options),
  );
}

async function findRejectableRevision(options: {
  rabProjectId: string;
  revisionId: string;
}) {
  const revision = await findRevision(options.revisionId, options.rabProjectId);
  assertRevisionCanBeRejected(revision);
  return revision;
}

async function rejectRevisionInTransaction(
  tx: ApprovalTx,
  revision: RevisionRecord,
  options: { userId: string; notes?: string },
) {
  await tx.rabRevisionApproval.upsert(
    buildRejectApprovalRecord(revision.id, options),
  );
  return tx.rabRevision.update({
    where: { id: revision.id },
    data: buildRejectedRevisionData(revision, options),
    include: { approvals: true },
  });
}

/** Approves a RAB revision and promotes it when approval threshold is met. */
export async function approveRabRevision(options: {
  rabProjectId: string;
  revisionId: string;
  userId: string;
}): Promise<RabRevisionApprovalResult> {
  await assertUserCanApproveRab(options.userId);
  const revision = await findApprovableRevision(options);

  if (hasReachedApprovalThreshold(revision.approvals)) {
    return promoteApprovedRevision(revision);
  }

  await createApprovalRecord(revision.id, options.userId);
  return finalizeApprovalProgress(revision, options.userId);
}

async function findApprovableRevision(options: {
  rabProjectId: string;
  revisionId: string;
  userId: string;
}) {
  const revision = await findRevision(options.revisionId, options.rabProjectId);
  assertRevisionCanBeApproved(revision);
  assertUserHasNotApprovedYet(revision.approvals, options.userId);
  return revision;
}

/** Throws when the current user has already approved the revision. */
function assertUserHasNotApprovedYet(
  approvals: Array<{ userId: string }>,
  userId: string,
) {
  if (!approvals.some((approval) => approval.userId === userId)) {
    return;
  }

  throw new RabRevisionApprovalError(
    "Anda sudah menyetujui revisi ini sebelumnya.",
    400,
  );
}

/** Persists a single approval record for the given revision and user. */
async function createApprovalRecord(revisionId: string, userId: string) {
  await prisma.rabRevisionApproval.create({
    data: {
      rabRevisionId: revisionId,
      userId,
      status: "APPROVED",
    },
  });
}

/** Completes approval progress and returns the route response payload. */
async function finalizeApprovalProgress(
  revision: RevisionRecord,
  userId: string,
): Promise<RabRevisionApprovalResult> {
  const approvalCount = await countApprovedRevisions(revision.id);
  const nextStatus = getRevisionApprovalStatus(approvalCount, revision.status);
  const updatedRevision = await updateRevisionStatus(
    revision,
    nextStatus,
    approvalCount,
    userId,
  );

  return {
    message: getApprovalMessage(approvalCount),
    data: updatedRevision,
  };
}

async function countApprovedRevisions(revisionId: string) {
  return prisma.rabRevisionApproval.count({
    where: { rabRevisionId: revisionId, status: "APPROVED" },
  });
}

async function assertUserCanApproveRab(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  const isUserSuperAdmin =
    user?.role?.isSuperAdmin || isSuperAdminRole(user?.role?.name);

  if (!user?.role?.canApproveRab && !isUserSuperAdmin) {
    throw new RabRevisionApprovalError(
      "Dilarang: Akun Anda tidak memiliki hak akses (role: canApproveRab) untuk menyetujui dokumen ini.",
      403,
    );
  }
}

async function findRevision(revisionId: string, rabProjectId: string) {
  const revision = await prisma.rabRevision.findUnique({
    where: { id: revisionId },
    include: {
      approvals: true,
      project: { select: { id: true } },
    },
  });

  if (!revision || revision.rabProjectId !== rabProjectId) {
    throw new RabRevisionApprovalError("Revisi RAB tidak ditemukan", 404);
  }

  return revision;
}

function assertRevisionCanBeApproved(revision: RevisionRecord) {
  assertPendingRevision(
    revision,
    "Revisi harus diajukan terlebih dahulu sebelum bisa disetujui.",
  );
}

function assertRevisionCanBeRejected(revision: RevisionRecord) {
  assertPendingRevision(
    revision,
    "Revisi harus diajukan terlebih dahulu sebelum bisa ditolak.",
  );
}

function assertPendingRevision(
  revision: RevisionRecord,
  invalidStatusMessage: string,
) {
  if (revision.status === RabRevisionStatus.APPROVED) {
    throw new RabRevisionApprovalError("Revisi RAB sudah disetujui.", 400);
  }

  if (revision.status === RabRevisionStatus.REJECTED) {
    throw new RabRevisionApprovalError("Revisi RAB sudah ditolak.", 400);
  }

  if (revision.status !== RabRevisionStatus.PENDING_APPROVAL) {
    throw new RabRevisionApprovalError(invalidStatusMessage, 400);
  }
}

async function promoteApprovedRevision(revision: RevisionRecord) {
  const syncedRevision = await syncApprovedRevision(revision);
  return {
    message:
      "Revisi sudah memenuhi approval dan dipromosikan sebagai baseline final.",
    data: syncedRevision,
  };
}

async function syncApprovedRevision(revision: RevisionRecord) {
  return prisma.$transaction(async (tx) => {
    const nextRevision = await tx.rabRevision.update({
      where: { id: revision.id },
      data: buildPromotedRevisionData(revision),
      include: { approvals: true },
    });

    await tx.rabProject.update({
      where: { id: revision.project.id },
      data: { finalApprovedRevisionId: revision.id },
    });

    return nextRevision;
  });
}

function updateRevisionStatus(
  revision: RevisionRecord,
  nextStatus: RabRevisionStatus,
  approvalCount: number,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const nextRevision = await tx.rabRevision.update({
      where: { id: revision.id },
      data: buildRevisionStatusUpdate(nextStatus, approvalCount, userId),
      include: { approvals: true },
    });

    if (approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD) {
      await tx.rabProject.update({
        where: { id: revision.project.id },
        data: { finalApprovedRevisionId: revision.id },
      });
    }

    return nextRevision;
  });
}
