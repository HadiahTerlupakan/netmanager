import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import type { MobileInventoryError } from "@/modules/inventory";

export type MobileInventoryAuthResult = Exclude<
  Awaited<ReturnType<typeof getMobileAuthPayload>>,
  NextResponse
>;

/** Autentikasi request mobile inventory dan kembalikan payload actor. */
export async function requireMobileInventoryAuth(request: NextRequest) {
  const authResult = await getMobileAuthPayload(request);
  if (authResult instanceof NextResponse) {
    return { response: authResult } as const;
  }

  return { auth: authResult } as const;
}

/** Bangun response error terstandar untuk route mobile inventory. */
export function createMobileInventoryErrorResponse(error: unknown) {
  const inventoryError = error as MobileInventoryError & { status?: number };

  if (
    inventoryError &&
    typeof inventoryError.message === "string" &&
    typeof inventoryError.status === "number"
  ) {
    return apiError(inventoryError.message, ErrorCodes.VALIDATION_ERROR, {
      status: inventoryError.status,
    });
  }

  return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
    status: 500,
  });
}
