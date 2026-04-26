import { ZodError } from "zod";
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
import {
  GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE,
  getCanvasingValidationMessage,
  hasGenericStatusUpdate,
  parseUpdateCanvasingInput,
} from "@/modules/marketing/validators/canvasingValidation";
import { canAccessCanvasingSite } from "../canvasingRouteAccess";

function canReadCanvasing(
  isSuperAdmin: boolean,
  isOwner: boolean,
  permissions: string[],
): boolean {
  return (
    isSuperAdmin ||
    isOwner ||
    permissions.includes("canvasing:read") ||
    permissions.includes("canvasing:verify")
  );
}

function canUpdateCanvasing(
  isSuperAdmin: boolean,
  isOwner: boolean,
  permissions: string[],
): boolean {
  return isSuperAdmin || isOwner || permissions.includes("canvasing:update");
}

function canManageCanvasingApproval(
  isSuperAdmin: boolean,
  permissions: string[],
): boolean {
  return isSuperAdmin || permissions.includes("canvasing:update");
}

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

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const isOwner = request.salesId === session.id;

    if (!canReadCanvasing(isSuperAdmin, isOwner, permissions)) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat data ini",
      );
    }

    const requestWithSales = await service.getRequestByIdWithSales(id);
    if (!requestWithSales) return ApiErrors.notFound("Data canvasing");

    if (
      !canAccessCanvasingSite(
        isSuperAdmin,
        permissions,
        session,
        requestWithSales,
      )
    ) {
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

    const service = createCanvasingService();
    const existingRequest = await service.getRequestById(id);
    if (!existingRequest) return ApiErrors.notFound("Data canvasing");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const isOwner = existingRequest.salesId === session.id;

    if (!canUpdateCanvasing(isSuperAdmin, isOwner, permissions)) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data ini",
      );
    }

    const requestWithSales = await service.getRequestByIdWithSales(id);
    if (!requestWithSales) return ApiErrors.notFound("Data canvasing");

    if (
      !canAccessCanvasingSite(
        isSuperAdmin,
        permissions,
        session,
        requestWithSales,
      )
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data ini",
      );
    }

    const body = await req.json();
    if (hasGenericStatusUpdate(body)) {
      return ApiErrors.badRequest(GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE);
    }

    const payload = parseUpdateCanvasingInput(body);
    const request = await service.updateRequest(id, payload);

    return apiSuccess(request);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(getCanvasingValidationMessage(error));
    }

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
    const service = createCanvasingService();
    const existingRequest = await service.getRequestById(id);
    if (!existingRequest) return ApiErrors.notFound("Data canvasing");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const isOwner = existingRequest.salesId === session.id;

    if (body.action === "cancel_approval") {
      if (!canManageCanvasingApproval(isSuperAdmin, permissions)) {
        return ApiErrors.forbidden(
          "Anda tidak memiliki akses untuk mengubah data ini",
        );
      }

      if (existingRequest.status !== "APPROVED") {
        return apiError(
          "Hanya canvasing dengan status APPROVED yang bisa dibatalkan",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      const requestWithSales = await service.getRequestByIdWithSales(id);
      if (!requestWithSales) return ApiErrors.notFound("Data canvasing");

      if (
        !canAccessCanvasingSite(
          isSuperAdmin,
          permissions,
          session,
          requestWithSales,
        )
      ) {
        return ApiErrors.forbidden(
          "Anda tidak memiliki akses untuk mengubah data ini",
        );
      }

      const updated = await service.cancelApproval(id);
      return apiSuccess(updated, { message: "Approval berhasil dibatalkan" });
    }

    if (!canUpdateCanvasing(isSuperAdmin, isOwner, permissions)) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data ini",
      );
    }

    const requestWithSales = await service.getRequestByIdWithSales(id);
    if (!requestWithSales) return ApiErrors.notFound("Data canvasing");

    if (
      !canAccessCanvasingSite(
        isSuperAdmin,
        permissions,
        session,
        requestWithSales,
      )
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah data ini",
      );
    }

    if (hasGenericStatusUpdate(body)) {
      return ApiErrors.badRequest(GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE);
    }

    const payload = parseUpdateCanvasingInput(body);
    const request = await service.updateRequest(id, payload);
    return apiSuccess(request);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(getCanvasingValidationMessage(error));
    }

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

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);

    if (!isSuperAdmin && !permissions.includes("canvasing:delete")) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus data ini",
      );
    }

    const service = createCanvasingService();
    const existing = await service.getRequestById(id);
    if (!existing) return ApiErrors.notFound("Data canvasing");

    const requestWithSales = await service.getRequestByIdWithSales(id);
    if (!requestWithSales) return ApiErrors.notFound("Data canvasing");

    if (
      !canAccessCanvasingSite(
        isSuperAdmin,
        permissions,
        session,
        requestWithSales,
      )
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus data ini",
      );
    }

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
