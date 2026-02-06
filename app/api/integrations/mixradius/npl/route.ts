import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { syncService } from "@/modules/integrations/services/MixRadiusSyncService";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);

  if (!user) {
    return ApiErrors.unauthorized();
  }

  const permissions = await getUserPermissions(user.id);
  if (!permissions.includes("mixradius:read")) {
    return ApiErrors.forbidden("You do not have permission to access MixRadius statistics");
  }

  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId') || undefined;
    
    const stats = await syncService.getNPLStatistics(groupId);
    return apiSuccess(stats);
  } catch (error) {
    console.error("[MixRadius NPL API] Error:", error);
    return ApiErrors.internalError("Failed to fetch NPL statistics");
  }
}
