import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { ApiErrors } from "@/lib/api-response";
import { TestCanvasingRouteService } from "@/modules/marketing";

const service = new TestCanvasingRouteService();

/**
 * Sample canvasing data untuk smoke-test route. Akses hanya untuk
 * super admin — tanpa guard, endpoint ini membocorkan canvasing teratas
 * (termasuk PII) ke unauthenticated client.
 */
export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");
  if (!isSuperAdminRole(session.role)) {
    return ApiErrors.forbidden("Endpoint test hanya untuk super admin");
  }

  const canvasing = await service.getLatestCanvasing();
  return NextResponse.json({ data: canvasing });
}
