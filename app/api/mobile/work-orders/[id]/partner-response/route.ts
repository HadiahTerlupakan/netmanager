import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";

import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { MobileWorkOrderPartnerService } from "@/modules/work-order";

const service = new MobileWorkOrderPartnerService();
const partnerResponseSchema = z.object({
  response: z.enum(["APPROVED", "REJECTED"], {
    error: "Response harus APPROVED atau REJECTED",
  }),
});

/**
 * Handle partner invitation response from mobile app.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id: workOrderId } = await params;
    const body = partnerResponseSchema.parse(await request.json());
    const result = await service.respondToInvitation({
      workOrderId,
      actorId: authResult.id as string,
      tenantId: authResult.tenantId as string,
      response: body.response,
    });

    if (result.isAlreadyResponded) {
      return NextResponse.json(
        {
          error: `Undangan sudah ${result.currentStatus === "APPROVED" ? "diterima" : "ditolak"} sebelumnya`,
          currentStatus: result.currentStatus,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      assignment: {
        id: result.assignment?.id,
        workOrderId: result.assignment?.workOrderId,
        userId: result.assignment?.userId,
        role: result.assignment?.role,
        status: result.assignment?.status,
        assignedAt: result.assignment?.assignedAt,
        respondedAt: result.assignment?.respondedAt,
        assignedById: result.assignment?.assignedById,
        user: result.assignment?.user,
      },
      message: `Undangan berhasil ${body.response === "APPROVED" ? "diterima" : "ditolak"}`,
    });
  } catch (error) {
    console.error("[API] Error responding to partner invitation:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validasi gagal", details: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "WORK_ORDER_NOT_FOUND") {
      return apiError("Work order tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    if (
      error instanceof Error &&
      error.message === "PARTNER_ASSIGNMENT_NOT_FOUND"
    ) {
      return apiError(
        "Anda tidak diundang sebagai partner di work order ini",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
