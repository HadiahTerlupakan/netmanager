import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { rabApprovalService } from "@/modules/finance";

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

    const userId = session.user.id;
    const permission = await rabApprovalService.canUserApproveRab(userId);
    if (!permission.isAllowed) {
      return NextResponse.json(
        {
          error:
            "Dilarang: Akun Anda tidak memiliki hak akses (role: canApproveRab) untuk menyetujui dokumen ini.",
        },
        { status: 403 },
      );
    }

    const result = await rabApprovalService.approveRabWithRetry(
      resolvedParams.id,
      userId,
    );

    return NextResponse.json({
      success: true,
      message:
        result.approvedCount >= 2
          ? "RAB Berhasil disetujui seutuhnya."
          : "Persetujuan dicatat (Menunggu 1 Persetujuan lagi).",
      data: result.updatedRab,
    });
  } catch (error) {
    if (rabApprovalService.isApprovalRouteError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memproses persetujuan." },
      { status: 500 },
    );
  }
}
