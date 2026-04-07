import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { createPointClaimService } from "@/modules/marketing";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";
import { prismaMitra } from "@/modules/database";

// GET - Get detail claim
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Session tidak valid");

    const { id } = await params;
    const service = createPointClaimService();
    const claim = await service.getClaimById(id);

    if (!claim) {
      return ApiErrors.notFound("Claim");
    }

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const isAdmin = isSuperAdmin || permissions.includes("point_claims:read");
    const isOwner = claim.salesId === session.id;

    if (!isAdmin && !isOwner) {
      return ApiErrors.forbidden("Anda tidak memiliki akses ke claim ini");
    }

    return apiSuccess(claim);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Gagal mengambil data claim";
    return ApiErrors.internalError(errorMessage);
  }
}

// PUT - Admin approve/reject claim
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Session tidak valid");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const canManage =
      isSuperAdmin ||
      permissions.includes("point_claims:update") ||
      permissions.includes("canvasing:update") ||
      permissions.includes("marketing:update");

    if (!canManage) {
      return ApiErrors.forbidden(
        "Missing point_claims:update atau canvasing:update permission",
      );
    }

    const { id } = await params;
    const body = await req.json();
    const service = createPointClaimService();

    let result;
    if (body.action === "approve") {
      result = await service.approveClaim(id, session.id, body.notes);

      // ==========================================
      // MITRA COMMISSION: Auto-add earning for MITRA_SALES on claim approval
      // ==========================================
      try {
        // Get the claim to find the salesId
        const claim = await service.getClaimById(id);
        if (claim?.salesId) {
          const salesMitra = await prismaMitra.mitra.findUnique({
            where: { id: claim.salesId },
            select: { mitraType: true, mitraRateCanvasing: true },
          });
          if (
            salesMitra?.mitraType === "MITRA_SALES" &&
            salesMitra.mitraRateCanvasing &&
            salesMitra.mitraRateCanvasing > 0
          ) {
            const { getMitraWalletService } = await import("@/modules/mitra");
            const walletService = getMitraWalletService();
            await walletService.addEarning(
              claim.salesId,
              salesMitra.mitraRateCanvasing,
              `Komisi Canvasing #${claim.canvasingId || id}`,
              claim.canvasingId || id,
              "CANVASING",
            );
          }
        }
      } catch (mitraErr) {
        // Non-blocking: log but don't fail the claim approval
        console.error(
          "[MitraCommission] Failed to add canvasing earning:",
          mitraErr,
        );
      }
    } else if (body.action === "reject") {
      if (!body.notes) {
        return apiError(
          "Alasan penolakan wajib diisi",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }
      result = await service.rejectClaim(id, session.id, body.notes);
    } else {
      return apiError(
        "Action tidak valid. Gunakan approve atau reject",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return apiSuccess(result, { message: `Claim berhasil di-${body.action}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Claim");
    }
    if (message.includes("Hanya claim")) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }
    return ApiErrors.internalError(message || "Gagal memproses claim");
  }
}

// DELETE - Admin delete claim
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Session tidak valid");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const canManage =
      isSuperAdmin || permissions.includes("point_claims:delete");

    if (!canManage) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menghapus claim",
      );
    }

    const { id } = await params;
    const service = createPointClaimService();
    await service.deleteClaim(id);

    return apiSuccess(null, { message: "Claim berhasil dihapus" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Claim");
    }
    if (message.includes("tidak bisa dihapus")) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }
    return ApiErrors.internalError(message || "Gagal menghapus claim");
  }
}
