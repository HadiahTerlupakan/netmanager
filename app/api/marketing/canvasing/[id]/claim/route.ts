import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { createPointClaimService } from "@/modules/marketing";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";

// POST - Sales submit claim dengan bukti
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const { id: canvasingId } = await params;
    const body = await req.json();

    const service = createPointClaimService();
    const claim = await service.submitClaim({
      canvasingId,
      salesId: session.id,
      buktiUrls: body.buktiUrls || [],
      buktiMetadata: body.buktiMetadata,
      keterangan: body.keterangan,
    });

    return apiSuccess(claim, {
      status: 201,
      message: "Claim poin berhasil diajukan",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal mengajukan claim poin";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Data canvasing");
    }
    if (
      message.includes("tidak memiliki akses") ||
      message.includes("sudah dikunci")
    ) {
      return ApiErrors.forbidden(message);
    }
    if (message.includes("belum") || message.includes("sudah pernah")) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }
    return ApiErrors.internalError(message);
  }
}

// GET - Get claim for specific canvasing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const { id: canvasingId } = await params;
    const service = createPointClaimService();
    const claim = await service.getClaimByCanvasingId(canvasingId);

    return apiSuccess({ claim: claim || null });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil data claim";
    return ApiErrors.internalError(message);
  }
}
