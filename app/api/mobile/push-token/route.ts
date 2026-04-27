import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  registerMobilePushToken,
  removeMobilePushToken,
} from "@/modules/notification";

/** Mendaftarkan push token mobile legacy. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const pushToken = (await request.json()).pushToken;
    if (!pushToken) {
      return apiError("Push token wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const result = await registerMobilePushToken(
      {
        id: authResult.id as string,
        tenantId: authResult.tenantId as string,
        role: authResult.role as string | undefined,
      },
      pushToken,
    );

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: unknown) {
    console.error("Push token registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/** Menghapus push token mobile legacy saat logout. */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const result = await removeMobilePushToken({
      id: authResult.id as string,
      tenantId: authResult.tenantId as string,
      role: authResult.role as string | undefined,
    });

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: unknown) {
    console.error("Push token removal error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
