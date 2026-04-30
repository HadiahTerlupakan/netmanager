import { RabRevisionStatus } from "../types/invoice.enums";
import { prisma } from "@/modules/database";
import {
  DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD,
  getRevisionApprovalStatus,
} from "../utils/rab-revisions";

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
  const revision = await findRevision(options.revisionId, options.rabProjectId);
  assertRevisionCanBeRejected(revision);

  return prisma.$transaction(async (tx) => {
    await tx.rabRevisionApproval.upsert({
      where: {
        rabRevisionId_userId: {
          rabRevisionId: revision.id,
          userId: options.userId,
        },
      },
      create: {
        rabRevisionId: revision.id,
        userId: options.userId,
        status: "REJECTED",
        notes: options.notes,
      },
      update: {
        status: "REJECTED",
        notes: options.notes,
      },
    });

    return tx.rabRevision.update({
      where: { id: revision.id },
      data: {
        status: RabRevisionStatus.REJECTED,
        notes: options.notes ?? revision.notes,
        rejectedById: options.userId,
        rejectedAt: new Date(),
      },
      include: { approvals: true },
    });
  });
}

/** Approves a RAB revision and promotes it when approval threshold is met. */
export async function approveRabRevision(options: {
  rabProjectId: string;
  revisionId: string;
  userId: string;
}): Promise<RabRevisionApprovalResult> {
  await assertUserCanApproveRab(options.userId);
  const revision = await findRevision(options.revisionId, options.rabProjectId);
  assertRevisionCanBeApproved(revision);
  assertUserHasNotApprovedYet(revision.approvals, options.userId);

  if (hasReachedApprovalThreshold(revision.approvals)) {
    return promoteApprovedRevision(revision);
  }

  await createApprovalRecord(revision.id, options.userId);
  return finalizeApprovalProgress(revision, options.userId);
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

/** Checks whether existing approvals already satisfy the approval threshold. */
function hasReachedApprovalThreshold(approvals: Array<{ status: string }>) {
  return getApprovedCount(approvals) >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD;
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
  revision: Awaited<ReturnType<typeof findRevision>>,
  userId: string,
): Promise<RabRevisionApprovalResult> {
  const approvalCount = await prisma.rabRevisionApproval.count({
    where: { rabRevisionId: revision.id, status: "APPROVED" },
  });
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

/** Builds the approval result message based on current approval count. */
function getApprovalMessage(approvalCount: number) {
  return approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD
    ? "Revisi RAB berhasil disetujui seutuhnya."
    : "Persetujuan revisi dicatat.";
}

async function assertUserCanApproveRab(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  const isSuperAdmin =
    user?.role?.isSuperAdmin ||
    user?.role?.name === "SUPER_ADMIN" ||
    user?.role?.name === "Super Admin";

  if (!user?.role?.canApproveRab && !isSuperAdmin) {
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

function assertRevisionCanBeApproved(
  revision: Awaited<ReturnType<typeof findRevision>>,
) {
  assertPendingRevision(
    revision,
    "Revisi harus diajukan terlebih dahulu sebelum bisa disetujui.",
  );
}

function assertRevisionCanBeRejected(
  revision: Awaited<ReturnType<typeof findRevision>>,
) {
  assertPendingRevision(
    revision,
    "Revisi harus diajukan terlebih dahulu sebelum bisa ditolak.",
  );
}

function assertPendingRevision(
  revision: Awaited<ReturnType<typeof findRevision>>,
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

function getApprovedCount(approvals: Array<{ status: string }>) {
  return approvals.filter((approval) => approval.status === "APPROVED").length;
}

async function promoteApprovedRevision(
  revision: Awaited<ReturnType<typeof findRevision>>,
) {
  const syncedRevision = await prisma.$transaction(async (tx) => {
    const nextRevision = await tx.rabRevision.update({
      where: { id: revision.id },
      data: {
        status: RabRevisionStatus.APPROVED,
        approvedById: revision.approvals.find(
          (approval: { status: string; userId: string }) =>
            approval.status === "APPROVED",
        )?.userId,
        approvedAt: new Date(),
      },
      include: { approvals: true },
    });

    await tx.rabProject.update({
      where: { id: revision.project.id },
      data: { finalApprovedRevisionId: revision.id },
    });

    return nextRevision;
  });

  return {
    message:
      "Revisi sudah memenuhi approval dan dipromosikan sebagai baseline final.",
    data: syncedRevision,
  };
}

function updateRevisionStatus(
  revision: Awaited<ReturnType<typeof findRevision>>,
  nextStatus: RabRevisionStatus,
  approvalCount: number,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const nextRevision = await tx.rabRevision.update({
      where: { id: revision.id },
      data: {
        status: nextStatus,
        approvedById:
          approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD
            ? userId
            : undefined,
        approvedAt:
          approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD
            ? new Date()
            : undefined,
      },
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
