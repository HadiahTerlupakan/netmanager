import { NextResponse } from "next/server";
import {
  mobileAttendanceCheckInRouteService,
  type MobileAttendanceCheckInRouteResult,
} from "@/modules/attendance";
import { apiError, createHandler } from "@/lib/api";
import { logger } from "@/lib/logger";

type MobileAttendanceCheckInRouteFailure = Extract<
  MobileAttendanceCheckInRouteResult,
  { success: false }
>;

function isMobileAttendanceCheckInRouteFailure(
  result: MobileAttendanceCheckInRouteResult,
): result is MobileAttendanceCheckInRouteFailure {
  return !result.success;
}

export const POST = createHandler({ auth: true }, async (request, ctx) => {
  const contentType = request.headers.get("content-type") || "";

  logger.info("Mobile check-in request received", {
    userId: ctx.session!.user.id,
    email: ctx.session!.user.email,
    role: ctx.session!.user.role,
    tenantId: ctx.session!.user.tenantId,
    contentType,
    hasBody: request.body !== null,
    url: request.url,
    method: request.method,
  });

  const result = await mobileAttendanceCheckInRouteService.checkIn({
    request,
    user: ctx.session!.user,
  });

  if (isMobileAttendanceCheckInRouteFailure(result)) {
    logger.warn("Mobile check-in failed", {
      userId: ctx.session!.user.id,
      email: ctx.session!.user.email,
      error: result.error,
      code: result.code,
      status: result.status,
      details: result.details,
    });

    return apiError(result.error, result.code, {
      status: result.status,
      ...(result.details ? { details: result.details } : {}),
    });
  }

  logger.info("Mobile check-in success", {
    userId: ctx.session!.user.id,
    email: ctx.session!.user.email,
    idempotentReplay: result.idempotentReplay,
  });

  return NextResponse.json(result.data, {
    headers: result.idempotentReplay
      ? { "X-Idempotent-Replay": "true" }
      : undefined,
  });
});
