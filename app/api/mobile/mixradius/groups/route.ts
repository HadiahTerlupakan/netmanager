import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getMixRadiusService } from "@/modules/integrations";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";

type MobileMixRadiusGroup = {
  id: string;
  name: string;
  owners: string[];
  isActive: boolean;
  siteId?: string | null;
};

function filterGroupsBySite(
  groups: MobileMixRadiusGroup[],
  siteId?: string | null,
): MobileMixRadiusGroup[] {
  if (!siteId) {
    return groups;
  }

  return groups.filter((group) => group.siteId === siteId);
}

/**
 * GET /api/mobile/mixradius/groups
 * Return MixRadius owner groups scoped to the mobile user's site.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const permissions = authResult.permissions || [];
    if (!permissions.includes("m_mixradius:read")) {
      return apiError(
        "Dilarang: Memerlukan izin m_mixradius:read",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    const mixRadius = getMixRadiusService();
    const groups = await mixRadius.getOwnerGroups();
    const filteredGroups = filterGroupsBySite(
      groups,
      authResult.siteId as string | null | undefined,
    ).map((group) => ({
      id: group.id,
      name: group.name,
      owners: group.owners,
      isActive: group.isActive,
      ...(group.siteId ? { siteId: group.siteId } : {}),
    }));

    return apiSuccess(filteredGroups);
  } catch (error) {
    console.error("Error fetching MixRadius groups:", error);
    return apiError(
      "Gagal mengambil grup MixRadius",
      ErrorCodes.INTERNAL_ERROR,
      {
        status: 500,
      },
    );
  }
}
