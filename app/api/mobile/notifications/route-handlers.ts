import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getMobileNotifications,
  handleMobileNotificationAction,
  parseMobileNotificationPagination,
  resolveMobileNotificationSiteId,
} from "@/modules/notification";

/** Resolve authenticated mobile notification identity. */
async function requireMobileUser(request: NextRequest) {
  const authResult = await getMobileAuthPayload(request);
  if (authResult instanceof NextResponse) return authResult;
  if (!authResult.userId) {
    return apiError("Token tidak valid", ErrorCodes.UNAUTHORIZED, {
      status: 401,
    });
  }

  return {
    userId: authResult.userId as string,
    siteId: resolveMobileNotificationSiteId({
      userId: authResult.userId as string,
      permissions: authResult.permissions,
      siteId: authResult.siteId,
    }),
  };
}

/** Handle mobile notifications list request. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileUser(request);
    if (auth instanceof NextResponse) return auth;

    const pagination = parseMobileNotificationPagination(
      request.nextUrl.searchParams,
    );
    const data = await getMobileNotifications({
      userId: auth.userId,
      limit: pagination.limit,
      cursor: pagination.cursor,
      siteId: auth.siteId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    logger.error("Error fetching notifications:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/** Handle mobile notifications mutation request. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileUser(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const result = await handleMobileNotificationAction({
      action: body.action,
      notificationId: body.notificationId,
      userId: auth.userId,
      siteId: auth.siteId,
    });

    if (!result.success) {
      return apiError(result.error, ErrorCodes.VALIDATION_ERROR, {
        status: result.status,
      });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: unknown) {
    logger.error("Error updating notifications:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
