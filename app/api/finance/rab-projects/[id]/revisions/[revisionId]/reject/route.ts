import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import * as z from "zod";

import { authOptions } from "@/lib/auth";
import {
  RabRevisionRouteService,
  isRouteServiceError,
} from "@/modules/finance";

const rabRevisionRouteService = new RabRevisionRouteService();

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

    const payload = rejectSchema.safeParse(await req.json().catch(() => ({})));

    if (!payload.success) {
      return NextResponse.json(
        { error: "Payload penolakan tidak valid." },
        { status: 400 },
      );
    }

    const updatedRevision = await rabRevisionRouteService.rejectRevision({
      projectId: resolvedParams.id,
      revisionId: resolvedParams.revisionId,
      userId: session.user.id,
      notes: payload.data.notes,
    });

    return NextResponse.json({
      success: true,
      message: "Revisi RAB ditolak.",
      data: updatedRevision,
    });
  } catch (error) {
    if (isRouteServiceError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const maybePrismaError = error as {
      code?: string;
      meta?: unknown;
      message?: string;
    };

    logger.error("Error rejecting RAB revision:", error);
    logger.error("[RAB_REVISION_REJECT_DIAG] Reject failed", {
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
