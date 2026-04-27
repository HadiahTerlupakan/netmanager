import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import {
  approveRabRevision,
  RabRevisionApprovalError,
} from "@/modules/finance";

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

    const result = await approveRabRevision({
      rabProjectId: resolvedParams.id,
      revisionId: resolvedParams.revisionId,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    if (error instanceof RabRevisionApprovalError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Error approving RAB revision:", error);
    return NextResponse.json(
      {
        error: "Terjadi kesalahan internal saat memproses persetujuan revisi.",
      },
      { status: 500 },
    );
  }
}
