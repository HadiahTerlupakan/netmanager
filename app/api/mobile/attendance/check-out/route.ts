import { NextRequest } from "next/server";
import { createHandler } from "@/lib/api";
import { MobileAttendanceCheckoutRouteService } from "@/modules/attendance";

const checkoutRouteService = new MobileAttendanceCheckoutRouteService();

export const POST = createHandler({ auth: true }, async (request, ctx) => {
  const userSession = ctx.session!.user;
  return checkoutRouteService.checkOut(
    request as NextRequest,
    userSession.id,
    userSession.tenantId as string,
  );
});
