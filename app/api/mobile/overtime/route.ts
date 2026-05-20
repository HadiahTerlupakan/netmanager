import { NextResponse } from "next/server";

import {
  apiError,
  ErrorCodes,
  createHandler,
  executeMobileWithIdempotency,
} from "@/lib/api";
import { convertAndSaveBase64 } from "@/lib/utils/image-upload";
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

// GET - Get user's overtime history
export const GET = createHandler(
  { auth: true, permissions: ["m_lembur:read"] },
  async (_request, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId as string;

    const result = await overtimeRouteService.getMobileContext(
      userId,
      tenantId,
    );
    return NextResponse.json(result);
  },
);

// POST - Create request / Start / Stop overtime
export const POST = createHandler(
  { auth: true, permissions: ["m_lembur:create"] },
  async (request, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId as string;

    const body = await request.json();
    const action = body.action as "request" | "start" | "stop" | undefined;

    if (!action || action === "request") {
      if (!body.date || !body.reason) {
        return apiError(
          "Tanggal dan alasan wajib diisi",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      // Idempotency: replay overtime request via SyncService bisa create
      // duplicate request — payroll dihitung 2x.
      return executeMobileWithIdempotency({
        request,
        scope: "overtime:create",
        userId,
        body,
        status: HTTP_CREATED,
        wrapData: false,
        handler: () =>
          overtimeService.createRequest(userId, {
            date: new Date(body.date),
            reason: body.reason,
            tenantId,
          }),
      });
    }

    if (action === "start") {
      if (!body.overtimeId || !body.photo) {
        return apiError(
          "ID dan foto wajib diisi",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      const result = await overtimeService.startOvertime(
        userId,
        body.overtimeId,
        {
          photo: await resolvePhotoUrl(body.photo, userId, "start"),
          location: body.location as string,
          timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
          tenantId,
        },
      );

      return NextResponse.json(result);
    }

    if (action === "stop") {
      if (!body.overtimeId || !body.photo) {
        return apiError(
          "ID dan foto wajib diisi",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      const result = await overtimeService.stopOvertime(
        userId,
        body.overtimeId,
        {
          photo: await resolvePhotoUrl(body.photo, userId, "stop"),
          location: body.location as string,
          timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
        },
      );

      return NextResponse.json(result);
    }

    return apiError("Aksi tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  },
);
