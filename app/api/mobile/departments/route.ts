import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getMobileDepartments } from "@/modules/roles";

/** Mengambil daftar departemen untuk picker mobile work order. */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    return NextResponse.json({
      success: true,
      data: await getMobileDepartments(),
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return apiError(
      "Gagal mengambil daftar departemen",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
