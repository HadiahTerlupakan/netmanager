import { NextRequest } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getMobileSalaryDetail } from "@/modules/salary";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Mengambil detail slip gaji mobile untuk user yang sedang login. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    const permissions = authResult.permissions || [];
    if (!permissions.includes("m_salary:read")) {
      return apiError(
        "Dilarang: Memerlukan izin m_salary:read",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    const salary = await getMobileSalaryDetail(
      {
        id: authResult.id as string,
        tenantId: authResult.tenantId as string,
      },
      (await params).id,
    );
    if (!salary) {
      return apiError(
        "Gaji tidak ditemukan atau tidak tersedia",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    return Response.json({ data: salary });
  } catch (error) {
    console.error("Error fetching mobile salary detail:", error);
    return apiError("Gagal mengambil detail gaji", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
