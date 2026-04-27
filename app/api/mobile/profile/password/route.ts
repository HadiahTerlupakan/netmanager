import { NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  changeMobilePassword,
  MobilePasswordChangeError,
} from "@/modules/users";
import { apiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await changeMobilePassword({
      auth: {
        id: authResult.id as string,
        tenantId: authResult.tenantId as string,
        role: authResult.role as string | undefined,
      },
      input: await request.json(),
    });

    return NextResponse.json({
      success: true,
      message: "Password berhasil diubah",
    });
  } catch (error: unknown) {
    if (error instanceof MobilePasswordChangeError) {
      return apiError(error.message, error.code, { status: error.status });
    }

    console.error("Password change error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
