import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  getMixRadiusService,
  type FetchCustomersParams,
} from "@/modules/integrations";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  createHandler,
  ErrorCodes,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden();
  }

  // Parse query parameters
  const { searchParams } = req.nextUrl;
  const start = parseInt(searchParams.get("start") || "0", 10);
  const length = parseInt(searchParams.get("length") || "10", 10);
  const search = searchParams.get("search") || "";
  const searchType = searchParams.get("searchType") || "all";
  const authStatus = searchParams.get("authStatus") || undefined;
  const sortBy = searchParams.get("sortBy") || undefined;
  const sortDir = (searchParams.get("sortDir") as "asc" | "desc") || undefined;
  const forceRefresh = searchParams.get("forceRefresh") === "true";

  const service = getMixRadiusService();

  const params: FetchCustomersParams = {
    start,
    length: Math.min(length, 100),
    search,
    searchType,
    sortBy,
    sortDir,
    forceRefresh,
  };

  if (authStatus) params.authStatus = authStatus;
  if (searchParams.get("ownerName"))
    params.ownerName = searchParams.get("ownerName") || undefined;
  if (searchParams.get("groupId"))
    params.groupId = searchParams.get("groupId") || undefined;
  if (searchParams.get("onlineStatus"))
    params.onlineStatus = searchParams.get("onlineStatus") as
      | "online"
      | "offline";
  if (searchParams.get("siteId"))
    params.siteId = searchParams.get("siteId") || undefined;

  try {
    const data = await service.fetchCustomersPPP(params);
    return apiSuccess(data);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "MixRadiusConfigError") {
      return apiError(error.message, ErrorCodes.MIXRADIUS_CONFIG_ERROR, {
        status: 503,
        details: { isConfigError: true },
      });
    }
    throw error;
  }
});
