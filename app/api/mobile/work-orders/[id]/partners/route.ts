import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/modules/database";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  canInvitePartnerToday,
  PARTNER_ON_LEAVE_ERROR_MESSAGE,
} from "@/modules/work-order/services/partner-invite-availability";

const DUPLICATE_PARTNER_ASSIGNMENT_ERROR_MESSAGE =
  "User sudah ditambahkan sebagai partner di work order ini";

async function hasPartnerAdminAccess(userId: string, tenantId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      role: {
        select: {
          accessAdminPanel: true,
          isSuperAdmin: true,
        },
      },
    },
  });

  return Boolean(user?.role?.accessAdminPanel || user?.role?.isSuperAdmin);
}

function canManageWorkOrderPartner(
  userId: string,
  options: {
    assignedById?: string | null;
    createdById?: string | null;
    assignedToId?: string | null;
    isAdmin: boolean;
  },
) {
  return (
    options.assignedById === userId ||
    options.createdById === userId ||
    options.assignedToId === userId ||
    options.isAdmin
  );
}

/**
 * POST /api/mobile/work-orders/[id]/partners
 * Menambahkan partner ke work order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Autentikasi user
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.id as string;
    const tenantId = authResult.tenantId as string;

    const { id: workOrderId } = await params;

    // Parse dan validasi request body
    const bodySchema = z.object({
      userId: z.string().min(1, "User ID wajib diisi"),
      role: z.literal("PARTNER"),
    });

    const body = await request.json();
    const validatedData = bodySchema.parse(body);

    // Validasi: Work order exists
    const workOrder = await prisma.workOrders.findFirst({
      where: { id: workOrderId, tenantId },
      select: {
        id: true,
        workOrderNumber: true,
        status: true,
        createdById: true,
        assignedToId: true,
      },
    });

    if (!workOrder) {
      return apiError("Work order tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    // Validasi: User yang akan diassign exists
    const targetUser = await prisma.user.findFirst({
      where: { id: validatedData.userId, tenantId },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) {
      return apiError("User tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    const isAdmin = await hasPartnerAdminAccess(userId, tenantId);

    if (
      !canManageWorkOrderPartner(userId, {
        createdById: workOrder.createdById,
        assignedToId: workOrder.assignedToId,
        isAdmin,
      })
    ) {
      return apiError(
        "Anda tidak memiliki akses untuk menambahkan partner ke work order ini",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    // Validasi: User belum assigned sebagai partner di WO ini
    const existingAssignment = await prisma.workOrderAssignments.findFirst({
      where: {
        workOrderId: workOrderId,
        userId: validatedData.userId,
        role: "PARTNER",
        tenantId,
      },
    });

    if (existingAssignment) {
      return apiError(
        DUPLICATE_PARTNER_ASSIGNMENT_ERROR_MESSAGE,
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const isPartnerAvailableToday = await canInvitePartnerToday(
      validatedData.userId,
      tenantId,
    );
    if (!isPartnerAvailableToday) {
      return apiError(
        PARTNER_ON_LEAVE_ERROR_MESSAGE,
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    // Buat assignment baru
    const assignment = await prisma.workOrderAssignments.create({
      data: {
        id: crypto.randomUUID(),
        workOrderId: workOrderId,
        userId: validatedData.userId,
        role: validatedData.role,
        status: "PENDING",
        assignedAt: new Date(),
        assignedById: userId,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // TODO: Kirim notifikasi ke partner yang diundang (opsional)
    // Implementasi notifikasi bisa ditambahkan di sini jika diperlukan

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
    console.error("[API] Error adding partner to work order:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validasi gagal", details: error.issues },
        { status: 400 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiError(
        DUPLICATE_PARTNER_ASSIGNMENT_ERROR_MESSAGE,
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
 * DELETE /api/mobile/work-orders/[id]/partners?assignmentId=xxx
 * Menghapus partner dari work order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Autentikasi user
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.id as string;
    const tenantId = authResult.tenantId as string;

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

    // Validasi: Assignment exists
    const assignment = await prisma.workOrderAssignments.findFirst({
      where: { id: assignmentId, tenantId },
      include: {
        workOrders: {
          select: {
            id: true,
            createdById: true,
            assignedToId: true,
          },
        },
      },
    });

    if (!assignment) {
      return apiError("Assignment tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    if (assignment.workOrderId !== workOrderId) {
      return apiError(
        "Assignment tidak sesuai dengan work order",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const isAdmin = await hasPartnerAdminAccess(userId, tenantId);

    if (
      !canManageWorkOrderPartner(userId, {
        assignedById: assignment.assignedById,
        createdById: assignment.workOrders.createdById,
        assignedToId: assignment.workOrders.assignedToId,
        isAdmin,
      })
    ) {
      return apiError(
        "Anda tidak memiliki akses untuk menghapus partner ini",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    // Hapus assignment
    await prisma.workOrderAssignments.delete({
      where: { id: assignmentId, tenantId },
    });

    return NextResponse.json({
      success: true,
      message: "Partner berhasil dihapus dari work order",
    });
  } catch (error) {
    console.error("[API] Error removing partner from work order:", error);

    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
