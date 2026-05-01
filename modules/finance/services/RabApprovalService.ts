import { Prisma } from "../repositories/prisma-boundary";
import { prisma } from "@/modules/database";

const RAB_APPROVAL_THRESHOLD = 2;
const MAX_APPROVAL_TRANSACTION_RETRIES = 2;
const TERMINAL_RAB_STATUSES = new Set(["APPROVED", "COMPLETED", "CANCELLED"]);

export type ApprovalRouteError = {
  status: number;
  message: string;
};

export class RabApprovalService {
  /** Check whether current user can approve RAB documents. */
  async canUserApproveRab(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    const isSuperAdmin =
      user?.role?.isSuperAdmin ||
      user?.role?.name === "SUPER_ADMIN" ||
      user?.role?.name === "Super Admin";

    return {
      user,
      isAllowed: !!user && (!!user.role?.canApproveRab || isSuperAdmin),
    };
  }

  /** Approve a RAB with serializable retry handling. */
  async approveRabWithRetry(rabId: string, userId: string) {
    for (
      let attempt = 0;
      attempt < MAX_APPROVAL_TRANSACTION_RETRIES;
      attempt += 1
    ) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const rab = await tx.rabProject.findUnique({
              where: { id: rabId },
              include: { approvals: true },
            });

            if (!rab) {
              throw this.createRouteError(404, "RAB tidak ditemukan");
            }

            if (TERMINAL_RAB_STATUSES.has(rab.status)) {
              throw this.createRouteError(
                400,
                `RAB sudah berstatus ${rab.status} dan tidak bisa disetujui lagi.`,
              );
            }

            const alreadyApproved = rab.approvals.some(
              (approval: { userId: string }) => approval.userId === userId,
            );

            if (alreadyApproved) {
              throw this.createRouteError(
                400,
                "Anda sudah menyetujui RAB ini sebelumnya.",
              );
            }

            try {
              await tx.rabApproval.create({
                data: {
                  rabProjectId: rabId,
                  userId,
                  status: "APPROVED",
                },
              });
            } catch (error) {
              if (this.isDuplicateApprovalConstraintError(error)) {
                throw this.createRouteError(
                  400,
                  "Anda sudah menyetujui RAB ini sebelumnya.",
                );
              }

              throw error;
            }

            const approvedCount = await tx.rabApproval.count({
              where: { rabProjectId: rabId, status: "APPROVED" },
            });
            const nextStatus =
              approvedCount >= RAB_APPROVAL_THRESHOLD
                ? "APPROVED"
                : rab.status === "DRAFT"
                  ? "PENDING_APPROVAL"
                  : rab.status;

            const updatedRab = await tx.rabProject.update({
              where: { id: rabId },
              data: { status: nextStatus },
              include: {
                approvals: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        role: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            });

            return { updatedRab, approvedCount };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (
          this.isSerializableTransactionError(error) &&
          attempt < MAX_APPROVAL_TRANSACTION_RETRIES - 1
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Unreachable approval retry loop");
  }

  /** Check whether error shape matches route error. */
  isApprovalRouteError(error: unknown): error is ApprovalRouteError {
    return !!(
      error &&
      typeof error === "object" &&
      "status" in error &&
      "message" in error &&
      typeof (error as { status: unknown }).status === "number" &&
      typeof (error as { message: unknown }).message === "string"
    );
  }

  /** Create a typed route error object. */
  private createRouteError(
    status: number,
    message: string,
  ): ApprovalRouteError {
    return { status, message };
  }

  /** Check whether the error is duplicate approval unique violation. */
  private isDuplicateApprovalConstraintError(error: unknown) {
    if (!error || typeof error !== "object" || !("code" in error)) {
      return false;
    }

    if ((error as { code?: string }).code !== "P2002") {
      return false;
    }

    const target = (error as { meta?: { target?: string[] | string } }).meta
      ?.target;

    if (Array.isArray(target)) {
      return target.includes("rabProjectId") && target.includes("userId");
    }

    return (
      typeof target === "string" &&
      target.includes("rabProjectId") &&
      target.includes("userId")
    );
  }

  /** Check whether the error is a serializable transaction retry case. */
  private isSerializableTransactionError(error: unknown) {
    return !!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2034"
    );
  }
}

export const rabApprovalService = new RabApprovalService();
