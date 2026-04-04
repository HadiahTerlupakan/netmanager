import { RabRevisionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import * as z from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/modules/database";

const rejectSchema = z.object({
  notes: z.string().trim().min(1).optional(),
});

export async function POST(
  req: NextRequest,
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
            "Dilarang: Akun Anda tidak memiliki hak akses (role: canApproveRab) untuk menolak dokumen ini.",
        },
        { status: 403 },
      );
    }

    const payload = rejectSchema.safeParse(await req.json().catch(() => ({})));

    if (!payload.success) {
      return NextResponse.json({ error: "Payload penolakan tidak valid." }, { status: 400 });
    }

    const revision = await prisma.rabRevision.findUnique({
      where: { id: resolvedParams.revisionId },
      include: { approvals: true },
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
        { error: "Revisi harus diajukan terlebih dahulu sebelum bisa ditolak." },
        { status: 400 },
      );
    }

    const existingUserApproval = revision.approvals.find(
      (approval) => approval.userId === session.user.id,
    );

    console.info("[RAB_REVISION_REJECT_DIAG] Reject attempt", {
      projectId: resolvedParams.id,
      revisionId: revision.id,
      revisionStatus: revision.status,
      actorUserId: session.user.id,
      approvalsCount: revision.approvals.length,
      hasExistingUserApproval: Boolean(existingUserApproval),
      existingUserApprovalStatus: existingUserApproval?.status ?? null,
      hasRejectNotes: Boolean(payload.data.notes),
    });

    if (existingUserApproval) {
      console.warn("[RAB_REVISION_REJECT_DIAG] Existing approval found for actor", {
        projectId: resolvedParams.id,
        revisionId: revision.id,
        actorUserId: session.user.id,
        existingUserApprovalId: existingUserApproval.id,
        existingUserApprovalStatus: existingUserApproval.status,
      });
    }

    const updatedRevision = await prisma.$transaction(async (tx) => {
      await tx.rabRevisionApproval.upsert({
        where: {
          rabRevisionId_userId: {
            rabRevisionId: revision.id,
            userId: session.user.id,
          },
        },
        create: {
          rabRevisionId: revision.id,
          userId: session.user.id,
          status: "REJECTED",
          notes: payload.data.notes,
        },
        update: {
          status: "REJECTED",
          notes: payload.data.notes,
        },
      });

      return tx.rabRevision.update({
        where: { id: revision.id },
        data: {
          status: RabRevisionStatus.REJECTED,
          notes: payload.data.notes ?? revision.notes,
          rejectedById: session.user.id,
          rejectedAt: new Date(),
        },
        include: { approvals: true },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Revisi RAB ditolak.",
      data: updatedRevision,
    });
  } catch (error) {
    const maybePrismaError = error as { code?: string; meta?: unknown; message?: string };

    console.error("Error rejecting RAB revision:", error);
    console.error("[RAB_REVISION_REJECT_DIAG] Reject failed", {
      code: maybePrismaError?.code ?? null,
      message: maybePrismaError?.message ?? null,
      meta: maybePrismaError?.meta ?? null,
    });

    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat menolak revisi." },
      { status: 500 },
    );
  }
}
