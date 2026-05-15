import { NextRequest } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getMobileMitraRouteService } from "@/modules/mitra";
import { withdrawRequestSchema } from "@/lib/validations/mitra";

const mobileMitraRouteService = getMobileMitraRouteService();

// GET /api/mobile/mitra/withdraw — List user's withdrawal history
export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) return authResult;

    if (authResult.role !== "MITRA") {
      return ApiErrors.forbidden("Bukan akun mitra");
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const result = await mobileMitraRouteService.getWithdrawHistory(
      {
        id: authResult.id as string,
        userId: authResult.userId as string | undefined,
        tenantId: authResult.tenantId as string | null,
        role: authResult.role,
      },
      page,
    );

    if (result.success === false) {
      return buildErrorResponse(result.error, result.status);
    }

    return apiSuccess(result.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat riwayat penarikan";
    return ApiErrors.internalError(message);
  }
}

// POST /api/mobile/mitra/withdraw — Create withdrawal request
export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) return authResult;

    if (authResult.role !== "MITRA") {
      return ApiErrors.forbidden("Bukan akun mitra");
    }

    const body = await req.json();
    const parsed = withdrawRequestSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest(
        parsed.error.issues[0]?.message || "Permintaan tidak valid",
      );
    }

    const result = await mobileMitraRouteService.requestWithdraw(
      {
        id: authResult.id as string,
        userId: authResult.userId as string | undefined,
        tenantId: authResult.tenantId as string | null,
        role: authResult.role,
      },
      {
        amount: parsed.data.amount,
        method: parsed.data.method,
        bankName: parsed.data.bankName || undefined,
        accountNumber: parsed.data.accountNumber || undefined,
        accountName: parsed.data.accountName || undefined,
        notes: parsed.data.notes || undefined,
      },
    );

    if (result.success === false) {
      return buildErrorResponse(result.error, result.status);
    }

    return apiSuccess(result.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat penarikan";
    return ApiErrors.internalError(message);
  }
}

/** Memetakan hasil service menjadi response error API standar. */
function buildErrorResponse(message?: string, status?: number) {
  if (status === 403) return ApiErrors.forbidden(message);
  if (status === 404) return ApiErrors.notFound(message || "Mitra");
  return ApiErrors.badRequest(message || "Permintaan tidak valid");
}
