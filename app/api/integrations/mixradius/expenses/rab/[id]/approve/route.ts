import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/modules/database";

const RAB_APPROVAL_THRESHOLD = 2;
const MAX_APPROVAL_TRANSACTION_RETRIES = 2;
const TERMINAL_RAB_STATUSES = new Set(["APPROVED", "COMPLETED", "CANCELLED"]);

type ApprovalRouteError = {
  status: number;
  message: string;
};

function isApprovalRouteError(error: unknown): error is ApprovalRouteError {
  return (
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    "message" in error &&
    typeof (error as { status: unknown }).status === "number" &&
    typeof (error as { message: unknown }).message === "string"
  );
}

function isDuplicateApprovalConstraintError(error: unknown): boolean {
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

  if (typeof target === "string") {
    return target.includes("rabProjectId") && target.includes("userId");
  }

  return false;
}

function isSerializableTransactionError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2034"
  );
}

async function approveRabWithRetry(rabId: string, userId: string) {
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
            throw {
              status: 404,
              message: "RAB tidak ditemukan",
            } satisfies ApprovalRouteError;
          }

          if (TERMINAL_RAB_STATUSES.has(rab.status)) {
            throw {
              status: 400,
              message: `RAB sudah berstatus ${rab.status} dan tidak bisa disetujui lagi.`,
            } satisfies ApprovalRouteError;
          }

          const alreadyApproved = rab.approvals.some(
            (approval: { userId: string }) => approval.userId === userId,
          );

          if (alreadyApproved) {
            throw {
              status: 400,
              message: "Anda sudah menyetujui RAB ini sebelumnya.",
            } satisfies ApprovalRouteError;
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
            if (isDuplicateApprovalConstraintError(error)) {
              throw {
                status: 400,
                message: "Anda sudah menyetujui RAB ini sebelumnya.",
              } satisfies ApprovalRouteError;
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
                      role: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
          });

          return {
            updatedRab,
            approvedCount,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        isSerializableTransactionError(error) &&
        attempt < MAX_APPROVAL_TRANSACTION_RETRIES - 1
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unreachable approval retry loop");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rabId = resolvedParams.id;
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    const isSuperAdmin =
      user?.role?.isSuperAdmin ||
      user?.role?.name === "SUPER_ADMIN" ||
      user?.role?.name === "Super Admin";

    if (!user?.role?.canApproveRab && !isSuperAdmin) {
      return NextResponse.json(
        {
          error:
            "Dilarang: Akun Anda tidak memiliki hak akses (role: canApproveRab) untuk menyetujui dokumen ini.",
        },
        { status: 403 },
      );
    }

    const result = await approveRabWithRetry(rabId, userId);

    return NextResponse.json({
      success: true,
      message:
        result.approvedCount >= RAB_APPROVAL_THRESHOLD
          ? "RAB Berhasil disetujui seutuhnya."
          : "Persetujuan dicatat (Menunggu 1 Persetujuan lagi).",
      data: result.updatedRab,
    });
  } catch (error) {
    if (isApprovalRouteError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Error approving RAB:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memproses persetujuan." },
      { status: 500 },
    );
  }
}
