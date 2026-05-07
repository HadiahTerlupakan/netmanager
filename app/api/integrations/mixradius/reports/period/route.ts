import {
  getMixRadiusAccessService,
  getMixRadiusService,
} from "@/modules/integrations";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = req.nextUrl;
  const service = getMixRadiusService();
  const user = ctx.session!.user;

  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius_income:read", "mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: mixradius_income:read",
    );
  }

  const start = parseInt(searchParams.get("start") || "0");
  const length = parseInt(searchParams.get("length") || "10");
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "issuedDate";
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
  const startDateStr = searchParams.get("fdate");
  const endDateStr = searchParams.get("tdate");
  const params = {
    start,
    length,
    search,
    sortBy,
    sortDir,
    startDate: startDateStr || undefined,
    endDate: endDateStr || undefined,
    serviceType: searchParams.get("stype") || undefined,
    paymentMethod: searchParams.get("payment_method") || undefined,
    ownerId: searchParams.get("owner_id") || undefined,
    groupId: searchParams.get("groupId") || undefined,
    siteId: searchParams.get("siteId") || undefined,
  };

  try {
    const [data, summary] = await Promise.all([
      service.fetchIncomeByPeriod(params),
      service.fetchIncomeSummary(params),
    ]);

    return apiSuccess({ ...data, summary });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "MixRadiusConfigError") {
      return apiSuccess({
        error: error.message,
        isConfigError: true,
        data: [],
        recordsTotal: 0,
        recordsFiltered: 0,
        summary: {
          profit: "0",
          feeSeller: "0",
          totalPlusPpn: "0",
          totalTransactions: "0",
        },
      });
    }
    throw error;
  }
});
