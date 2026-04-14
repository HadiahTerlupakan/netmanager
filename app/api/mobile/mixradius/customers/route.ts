import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { MixRadiusConfigError, MixRadiusService } from "@/modules/integrations";
import { apiError, ErrorCodes } from "@/lib/api-response";

/**
 * GET /api/mobile/mixradius/customers
 * Search customers from MixRadius for WO Request form
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const payload = authResult;

    // Check Permission
    const permissions = payload.permissions || [];
    if (!permissions.includes("m_mixradius:read")) {
      return apiError(
        "Dilarang: Memerlukan izin m_mixradius:read",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const start = parseInt(searchParams.get("start") || "0", 10);
    const length = parseInt(searchParams.get("length") || "20", 10);
    const searchType = searchParams.get("searchType") || "all";
    const groupId = searchParams.get("groupId") || undefined;
    const authStatus = searchParams.get("authStatus") || undefined;

    // Get user's siteId for filtering by ManagementSite -> OwnerGroup
    const userSiteId = payload.siteId as string | undefined;

    const mixRadius = new MixRadiusService();
    const params: {
      search: string;
      start: number;
      length: number;
      searchType: string;
      siteId?: string;
      groupId?: string;
      authStatus?: string;
    } = {
      search,
      start,
      length,
      searchType,
    };
    if (userSiteId) {
      params.siteId = userSiteId;
    }
    if (groupId) {
      params.groupId = groupId;
    }
    if (authStatus) {
      params.authStatus = authStatus;
    }
    const result = await mixRadius.fetchCustomersPPP(params);

    // Map to simpler format for mobile
    const customers = result.data.map((c) => ({
      id: c.id,
      memberId: c.member_id,
      username: c.username,
      fullname: c.fullname,
      phone: c.phonenumber,
      address: c.address,
      planName: c.plan_name,
      ownerName: c.owner_name,
      status: c.auth_status,
      isOnline: c.online || false, // Status koneksi dari active sessions
    }));

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Error searching MixRadius customers:", error);

    if (
      error instanceof MixRadiusConfigError ||
      (error instanceof Error && error.name === "MixRadiusConfigError")
    ) {
      return apiError(error.message, "MIXRADIUS_CONFIG_ERROR", { status: 503 });
    }

    return apiError("Gagal mencari pelanggan", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
