import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileInventoryService } from "@/modules/inventory";
import {
  createMobileInventoryErrorResponse,
  executeMobileInventoryWithIdempotency,
  requireMobileInventoryAuth,
} from "../route-utils";

const service = getMobileInventoryService();

export async function POST(request: NextRequest) {
  try {
    const authState = await requireMobileInventoryAuth(request);
    if ("response" in authState) return authState.response;
    const authResult = authState.auth;

    if (
      !hasMobilePermission(
        authResult.permissions as string[] | undefined,
        "m_barang_masuk:create",
      )
    ) {
      return apiError("Akses inventory masuk ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const body = await request.json();

    return executeMobileInventoryWithIdempotency({
      request,
      scope: "inventory:masuk",
      userId: authResult.userId as string,
      body,
      handler: () =>
        service.createBarangMasuk({
          actorId: authResult.userId as string,
          tenantId: authResult.tenantId as string,
          ...body,
        }),
    });
  } catch (error) {
    logger.error("Mobile Barang Masuk Error:", error as Error);
    return createMobileInventoryErrorResponse(error);
  }
}
