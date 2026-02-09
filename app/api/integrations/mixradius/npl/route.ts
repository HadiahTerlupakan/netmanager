import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { syncService } from "@/modules/integrations/services/MixRadiusSyncService";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);

  if (!user) {
    return ApiErrors.unauthorized();
  }

  const userWithRole = user as { id: string; role?: string; isSuperAdmin?: boolean }
  const isSuper = isSuperAdmin(userWithRole)

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id);
    const hasAccess = permissions.includes('*') || permissions.includes("mixradius:read");
    if (!hasAccess) {
      return ApiErrors.forbidden("You do not have permission to access MixRadius statistics");
    }
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
