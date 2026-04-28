import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";

import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { MobileWorkOrderPartnerService } from "@/modules/work-order";

const service = new MobileWorkOrderPartnerService();
const createPartnerSchema = z.object({
  userId: z.string().min(1, "User ID wajib diisi"),
  role: z.literal("PARTNER"),
});

/**
 * Add partner to a work order.
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
    const body = createPartnerSchema.parse(await request.json());
    const assignment = await service.addPartner({
      workOrderId,
      actorId: authResult.id as string,
      tenantId: authResult.tenantId as string,
      partnerUserId: body.userId,
    });

    return NextResponse.json(
      {
        success: true,
        assignment: {
          id: assignment.id,
          workOrderId: assignment.workOrderId,
          userId: assignment.userId,
          role: assignment.role,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          assignedById: assignment.assignedById,
          user: assignment.user,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error("[API] Error adding partner to work order:", error);

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

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return apiError("User tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return apiError(
        "Anda tidak memiliki akses untuk menambahkan partner ke work order ini",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    if (error instanceof Error && error.message === "DUPLICATE_ASSIGNMENT") {
      return apiError(
        service.getDuplicateAssignmentErrorMessage(),
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "PARTNER_ON_LEAVE") {
      return apiError(
        service.getPartnerOnLeaveErrorMessage(),
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (service.isDuplicateAssignmentError(error)) {
      return apiError(
        service.getDuplicateAssignmentErrorMessage(),
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}

/**
 * Remove partner from a work order.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id: workOrderId } = await params;
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return apiError(
        "Assignment ID wajib diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    await service.removePartner({
      assignmentId,
      workOrderId,
      actorId: authResult.id as string,
      tenantId: authResult.tenantId as string,
    });

    return NextResponse.json({
      success: true,
      message: "Partner berhasil dihapus dari work order",
    });
  } catch (error) {
    logger.error("[API] Error removing partner from work order:", error);

    if (error instanceof Error && error.message === "ASSIGNMENT_NOT_FOUND") {
      return apiError("Assignment tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    if (
      error instanceof Error &&
      error.message === "ASSIGNMENT_WORK_ORDER_MISMATCH"
    ) {
      return apiError(
        "Assignment tidak sesuai dengan work order",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return apiError(
        "Anda tidak memiliki akses untuk menghapus partner ini",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
