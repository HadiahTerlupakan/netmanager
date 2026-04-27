import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  MixRadiusConfigError,
  MixRadiusProfitLossService,
} from "@/modules/integrations";
import { createHandler, ApiErrors } from "@/lib/api";

export const dynamic = "force-dynamic";

const mixRadiusProfitLossService = new MixRadiusProfitLossService();

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);

  // Check permission - need access to expense OR mixradius_profit_loss
  const hasAccess =
    isSuper ||
    (await hasPermission("expense:read")) ||
    (await hasPermission("mixradius_expenses:read")) ||
    (await hasPermission("mixradius_profit_loss:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Butuh permission: mixradius_profit_loss:read",
    );
  }

  const { searchParams } = req.nextUrl;
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");

  try {
    const report = await mixRadiusProfitLossService.getReport({
      startDate: startDateParam,
      endDate: endDateParam,
      siteId,
    });

    return NextResponse.json(report);
  } catch (error: unknown) {
    if (error instanceof MixRadiusConfigError) {
      return NextResponse.json(
        mixRadiusProfitLossService.getConfigErrorResponse(error),
      );
    }

    throw error;
  }
});
