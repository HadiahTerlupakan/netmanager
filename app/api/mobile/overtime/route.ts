import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { executeMobileWithIdempotency } from "@/lib/api";
import { convertAndSaveBase64 } from "@/lib/utils/image-upload";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { OvertimeRouteService, OvertimeService } from "@/modules/overtime";

const overtimeService = new OvertimeService();
const overtimeRouteService = new OvertimeRouteService(overtimeService);
const HTTP_CREATED = 201;

/** Build upload folder date string. */
function createDateFolder(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Convert base64 photo to stored url when needed. */
async function resolvePhotoUrl(
  photo: string,
  userId: string,
  action: "start" | "stop",
): Promise<string> {
  if (photo.startsWith("http") || photo.startsWith("/uploads")) {
    return photo;
  }

  return convertAndSaveBase64(
    photo,
    `public/uploads/overtime/${createDateFolder()}`,
    `${userId}_${action}_${Date.now()}`,
    "employee-attendance",
    userId,
  );
}

/** Parse auth payload from mobile request. */
async function getAuthContext(request: NextRequest) {
  const authResult = await getMobileAuthPayload(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const userId = authResult.id as string;
  const tenantId = authResult.tenantId as string;
  if (!userId) {
    return apiError("Token tidak valid", ErrorCodes.UNAUTHORIZED, {
      status: 401,
    });
  }

  return { userId, tenantId };
}

// GET - Get user's overtime history
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const result = await overtimeRouteService.getMobileContext(
      authContext.userId,
      authContext.tenantId,
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("Mobile Overtime GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
      { status: 500 },
    );
  }
}

// POST - Create request / Start / Stop overtime
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const body = await request.json();
    const action = body.action as "request" | "start" | "stop" | undefined;

    if (!action || action === "request") {
      if (!body.date || !body.reason) {
        return apiError(
          "Tanggal dan alasan wajib diisi",
          ErrorCodes.VALIDATION_ERROR,
          {
            status: 400,
          },
        );
      }

      // Idempotency: replay overtime request via SyncService bisa create
      // duplicate request — payroll dihitung 2x.
      return executeMobileWithIdempotency({
        request,
        scope: "overtime:create",
        userId: authContext.userId,
        body,
        status: HTTP_CREATED,
        wrapData: false,
        handler: () =>
          overtimeService.createRequest(authContext.userId, {
            date: new Date(body.date),
            reason: body.reason,
            tenantId: authContext.tenantId,
          }),
      });
    }

    if (action === "start") {
      if (!body.overtimeId || !body.photo) {
        return apiError(
          "ID dan foto wajib diisi",
          ErrorCodes.VALIDATION_ERROR,
          {
            status: 400,
          },
        );
      }

      const result = await overtimeService.startOvertime(
        authContext.userId,
        body.overtimeId,
        {
          photo: await resolvePhotoUrl(body.photo, authContext.userId, "start"),
          location: body.location as string,
          timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
          tenantId: authContext.tenantId,
        },
      );

      return NextResponse.json(result);
    }

    if (action === "stop") {
      if (!body.overtimeId || !body.photo) {
        return apiError(
          "ID dan foto wajib diisi",
          ErrorCodes.VALIDATION_ERROR,
          {
            status: 400,
          },
        );
      }

      const result = await overtimeService.stopOvertime(
        authContext.userId,
        body.overtimeId,
        {
          photo: await resolvePhotoUrl(body.photo, authContext.userId, "stop"),
          location: body.location as string,
          timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
        },
      );

      return NextResponse.json(result);
    }

    return apiError("Aksi tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  } catch (error: unknown) {
    logger.error("Mobile Overtime POST Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
      { status: 400 },
    );
  }
}
