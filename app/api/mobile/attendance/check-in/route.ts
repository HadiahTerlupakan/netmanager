import { NextResponse } from "next/server";
import {
  mobileAttendanceCheckInRouteService,
  type MobileAttendanceCheckInRouteResult,
} from "@/modules/attendance";
import { apiError, createHandler } from "@/lib/api";

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
  const result = await mobileAttendanceCheckInRouteService.checkIn({
    request,
    user: ctx.session!.user,
  });

  if (isMobileAttendanceCheckInRouteFailure(result)) {
    return apiError(result.error, result.code, {
      status: result.status,
      ...(result.details ? { details: result.details } : {}),
    });
  }

  return NextResponse.json(result.data, {
    headers: result.idempotentReplay
      ? { "X-Idempotent-Replay": "true" }
      : undefined,
  });
});
