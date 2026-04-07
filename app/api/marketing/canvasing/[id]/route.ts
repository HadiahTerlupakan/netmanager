import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { createCanvasingService } from "@/modules/marketing";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const service = createCanvasingService();
    const request = await service.getRequestById(id);

    if (!request) return ApiErrors.notFound("Data canvasing");

    // RBAC Check - Allow owner to view their own request
    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const isOwner = request.salesId === session.id;

    if (!isSuperAdmin && !isOwner && !permissions.includes("canvasing:read")) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat data ini",
      );
    }

    return apiSuccess(request);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal mengambil detail canvasing";
    return ApiErrors.internalError(message);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    // RBAC Check - Allow owner to update their own request
    const service = createCanvasingService();
    const existingRequest = await service.getRequestById(id);
    if (!existingRequest) return ApiErrors.notFound("Data canvasing");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const isOwner = existingRequest.salesId === session.id;

    // Allow if: super admin, owner, or has canvasing:update permission
    if (
      !isSuperAdmin &&
      !isOwner &&
      !permissions.includes("canvasing:update")
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data ini",
      );
    }

    const body = await req.json();
    const request = await service.updateRequest(id, body);

    return apiSuccess(request);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal memperbarui data canvasing";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Data canvasing");
    }
    return ApiErrors.internalError(message);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const body = await req.json();

    // RBAC Check
    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);

    if (!isSuperAdmin && !permissions.includes("canvasing:update")) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data ini",
      );
    }

    const service = createCanvasingService();

    // Handle cancel_approval action
    if (body.action === "cancel_approval") {
      const request = await service.getRequestById(id);
      if (!request) return ApiErrors.notFound("Data canvasing");

      if (request.status !== "APPROVED") {
        return apiError(
          "Hanya canvasing dengan status APPROVED yang bisa dibatalkan",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      // Cancel approval - reset to PENDING
      const updated = await service.cancelApproval(id);
      return apiSuccess(updated, { message: "Approval berhasil dibatalkan" });
    }

    // Regular update
    const request = await service.updateRequest(id, body);
    return apiSuccess(request);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal memperbarui data canvasing";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Data canvasing");
    }
    if (message.includes("APPROVED") || message.includes("PENDING")) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }
    return ApiErrors.internalError(message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    // RBAC Check
    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);

    if (!isSuperAdmin && !permissions.includes("canvasing:delete")) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus data ini",
      );
    }

    const service = createCanvasingService();

    // Check if exists first
    const existing = await service.getRequestById(id);
    if (!existing) return ApiErrors.notFound("Data canvasing");

    await service.deleteRequest(id);

    return apiSuccess(null, { message: "Data canvasing berhasil dihapus" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus data canvasing";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Data canvasing");
    }
    return ApiErrors.internalError(message);
  }
}
