import { RabRevisionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import {
  DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD,
  getRevisionApprovalStatus,
} from "@/modules/finance/rab-revisions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    const revision = await prisma.rabRevision.findUnique({
      where: { id: resolvedParams.revisionId },
      include: {
        approvals: true,
        project: { select: { id: true } },
      },
    });

    if (!revision || revision.rabProjectId !== resolvedParams.id) {
      return NextResponse.json({ error: "Revisi RAB tidak ditemukan" }, { status: 404 });
    }

    if (revision.status === RabRevisionStatus.APPROVED) {
      return NextResponse.json({ error: "Revisi RAB sudah disetujui." }, { status: 400 });
    }

    if (revision.status === RabRevisionStatus.REJECTED) {
      return NextResponse.json({ error: "Revisi RAB sudah ditolak." }, { status: 400 });
    }

    if (revision.status !== RabRevisionStatus.PENDING_APPROVAL) {
      return NextResponse.json(
        { error: "Revisi harus diajukan terlebih dahulu sebelum bisa disetujui." },
        { status: 400 },
      );
    }

    const existingApprovedCount = revision.approvals.filter(
      (approval: { status: string; userId: string }) => approval.status === "APPROVED",
    ).length;

    if (existingApprovedCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD) {
      const syncedRevision = await prisma.$transaction(async (tx) => {
        const nextRevision = await tx.rabRevision.update({
          where: { id: revision.id },
          data: {
            status: RabRevisionStatus.APPROVED,
            approvedById: revision.approvals.find(
              (approval: { status: string; userId: string }) => approval.status === "APPROVED",
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

      return NextResponse.json({
        success: true,
        message: "Revisi sudah memenuhi approval dan dipromosikan sebagai baseline final.",
        data: syncedRevision,
      });
    }

    if (revision.approvals.some((approval: { userId: string }) => approval.userId === session.user.id)) {
      return NextResponse.json({ error: "Anda sudah menyetujui revisi ini sebelumnya." }, { status: 400 });
    }

    await prisma.rabRevisionApproval.create({
      data: {
        rabRevisionId: revision.id,
        userId: session.user.id,
        status: "APPROVED",
      },
    });

    const approvalCount = await prisma.rabRevisionApproval.count({
      where: { rabRevisionId: revision.id, status: "APPROVED" },
    });
    const nextStatus = getRevisionApprovalStatus(approvalCount, revision.status);

    const updatedRevision = await prisma.$transaction(async (tx) => {
      const nextRevision = await tx.rabRevision.update({
        where: { id: revision.id },
        data: {
          status: nextStatus,
          approvedById:
            approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD ? session.user.id : undefined,
          approvedAt:
            approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD ? new Date() : undefined,
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

    return NextResponse.json({
      success: true,
      message:
        approvalCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD
          ? "Revisi RAB berhasil disetujui seutuhnya."
          : "Persetujuan revisi dicatat.",
      data: updatedRevision,
    });
  } catch (error) {
    console.error("Error approving RAB revision:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memproses persetujuan revisi." },
      { status: 500 },
    );
  }
}
