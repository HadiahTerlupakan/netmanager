import { ZodError } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  createCanvasingService,
  getCanvasingValidationMessage,
  parseCanvasingStatusParam,
  parseCreateCanvasingInput,
} from "@/modules/marketing";

type CanvasingStatusValue = "PENDING" | "APPROVED" | "REJECTED";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const canReadAll =
      isSuperAdmin ||
      permissions.includes("canvasing:read") ||
      permissions.includes("canvasing:verify");

    // Site restriction only applies if user has canvasing:site_only permission
    const user = session as {
      id: string;
      siteId?: string;
      siteIds?: string[];
      role: string;
    };
    const isSiteRestricted =
      !isSuperAdmin && permissions.includes("canvasing:site_only");

    const { searchParams } = new URL(req.url);
    const status = parseCanvasingStatusParam(searchParams.get("status"));
    let salesId = searchParams.get("salesId") || undefined;
    let filterSiteId: string | undefined =
      searchParams.get("siteId") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const cursor = searchParams.get("cursor") || undefined;
    const search = searchParams.get("search")?.trim();

    const canVerify = permissions.includes("canvasing:verify");
    const canViewOthers = isSuperAdmin || canVerify || canReadAll;

    if (!canViewOthers) {
      salesId = session.id;
    } else if (isSiteRestricted) {
      // Enforce site restriction: only show data from user's allowed sites
      if (user.siteIds && user.siteIds.length > 0) {
        // If user provides siteId filter, validate it's in their allowed sites
        if (filterSiteId && !user.siteIds.includes(filterSiteId)) {
          return NextResponse.json({
            data: [],
            total: 0,
            page,
            limit,
            nextCursor: null,
            summary: {
              total: 0,
              pending: 0,
              approved: 0,
              rejected: 0,
              pendingClaims: 0,
            },
          });
        }
        // If no siteId filter provided, restrict to first allowed site
        if (!filterSiteId) {
          filterSiteId = user.siteIds[0];
        }
      } else {
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          limit,
          nextCursor: null,
          summary: {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            pendingClaims: 0,
          },
        });
      }
    }

    const service = createCanvasingService();
    const filterParams: {
      status?: CanvasingStatusValue;
      salesId?: string;
      siteId?: string;
      search?: string;
    } = {};

    if (status) filterParams.status = status as CanvasingStatusValue;
    if (salesId) filterParams.salesId = salesId;
    if (filterSiteId) filterParams.siteId = filterSiteId;
    if (search) filterParams.search = search;

    const result = await service.getAllRequests(filterParams, page, limit, {
      cursor,
    });

    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      limit,
      nextCursor: result.nextCursor ?? null,
      summary: result.summary,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(getCanvasingValidationMessage(error));
    }

    const message =
      error instanceof Error ? error.message : "Gagal mengambil data canvasing";
    return ApiErrors.internalError(message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions =
      session.permissions ?? (await getUserPermissions(session.id));
    const canCreateCanvasing =
      isSuperAdmin ||
      permissions.includes("canvasing:create") ||
      hasMobilePermission(permissions, "m_canvasing:create");

    if (!canCreateCanvasing) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat data canvasing",
      );
    }

    const body = await req.json();
    const payload = parseCreateCanvasingInput({
      ...body,
      salesId: session.id,
    });

    const service = createCanvasingService();
    const request = await service.createRequest(payload);

    return apiSuccess(request, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(getCanvasingValidationMessage(error));
    }

    const message =
      error instanceof Error ? error.message : "Gagal membuat data canvasing";
    return ApiErrors.internalError(message);
  }
}
