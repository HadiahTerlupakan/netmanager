import { NextResponse } from "next/server";
import {
  AttendanceService,
  AttendanceIdempotencyService,
  AttendancePhotoService,
  AttendanceTimezoneService,
} from "@/modules/attendance";
import { apiError, ErrorCodes, createHandler } from "@/lib/api";

export const POST = createHandler({ auth: true }, async (request, ctx) => {
  const userSession = ctx.session!.user;
  const userId = userSession.id;
  const tenantId = userSession.tenantId as string;
  let resolvedRequestId: string | null = null;

  try {
    let bodyRequestId: string | undefined;

    const timezoneService = new AttendanceTimezoneService();
    const timezone = await timezoneService.getTimezone(tenantId);

    // Initialize optional fields
    let photoUrl = null;
    let location = "";
    let notes = "";
    let latitude: number | undefined;
    let longitude: number | undefined;
    let offlineCapturedAt: Date | undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      const photo = formData.get("photo") as File;
      location = formData.get("location") as string;
      notes = formData.get("notes") as string;
      const latStr = formData.get("latitude") as string;
      const lngStr = formData.get("longitude") as string;
      const requestIdValue = formData.get("requestId");

      if (typeof requestIdValue === "string") bodyRequestId = requestIdValue;

      if (latStr && lngStr) {
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (
          isNaN(lat) ||
          isNaN(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          return apiError(
            "Koordinat tidak valid",
            ErrorCodes.INVALID_COORDINATES,
            { status: 400 },
          );
        }
        latitude = lat;
        longitude = lng;
      }

      if (photo) {
        const photoService = new AttendancePhotoService();
        photoUrl = await photoService.processPhoto(photo, userId, "checkin");
      }
      ctx.validated = {
        location,
        latitude,
        longitude,
        isOffline: !!offlineCapturedAt,
      };
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      location = body.location;
      notes = body.notes;
      bodyRequestId = body.requestId;

      if (typeof body.capturedAt === "string") {
        const parsedCapturedAt = new Date(body.capturedAt);
        if (Number.isNaN(parsedCapturedAt.getTime())) {
          return apiError(
            "Format capturedAt tidak valid",
            ErrorCodes.VALIDATION_ERROR,
            { status: 400 },
          );
        }
        offlineCapturedAt = parsedCapturedAt;
      }

      if (body.latitude !== undefined && body.longitude !== undefined) {
        const { validateCoordinates } = await import("@/lib/validation-utils");
        const coordValidation = validateCoordinates(
          body.latitude,
          body.longitude,
        );
        if (!coordValidation.valid)
          return apiError(
            coordValidation.error ?? "Koordinat tidak valid",
            ErrorCodes.INVALID_COORDINATES,
            { status: 400 },
          );
        latitude = coordValidation.latitude!;
        longitude = coordValidation.longitude!;
      }

      if (body.photoUrl) {
        if (body.photoUrl.startsWith("/uploads/")) {
          photoUrl = body.photoUrl;
        } else {
          const host = request.headers.get("host");
          const trustedDomains = [
            "cdn.radpro.id",
            "localhost:3000",
            "0.0.0.0:3000",
            "localhost",
          ];
          if (host) {
            trustedDomains.push(host);
            trustedDomains.push(host.split(":")[0]);
          }
          try {
            const url = new URL(body.photoUrl);
            const isLocalIP =
              process.env.NODE_ENV !== "production" &&
              /^(192\.168|10|127|172\.(1[6-9]|2[0-9]|3[0-1]))\./.test(
                url.hostname,
              );
            const isTrusted =
              isLocalIP ||
              trustedDomains.some(
                (domain) =>
                  url.host === domain ||
                  url.hostname === domain ||
                  url.host.endsWith("." + domain),
              );
            if (isTrusted) photoUrl = body.photoUrl;
            else
              return apiError(
                "Photo URL tidak valid",
                ErrorCodes.VALIDATION_ERROR,
                { status: 400 },
              );
          } catch {
            return apiError(
              "Format Photo URL tidak valid",
              ErrorCodes.VALIDATION_ERROR,
              { status: 400 },
            );
          }
        }
      }

      ctx.validated = body;
    }

    const attendanceService = new AttendanceService();
    const idempotencyService = new AttendanceIdempotencyService();

    resolvedRequestId = idempotencyService.resolveRequestId(
      request.headers.get("Idempotency-Key") ??
        request.headers.get("idempotency-key"),
      bodyRequestId,
    );

    let payloadHash: string | null = null;
    if (resolvedRequestId) {
      payloadHash = idempotencyService.buildPayloadHash({
        location,
        notes,
        latitude,
        longitude,
        photoUrl,
        offlineTime: offlineCapturedAt?.toISOString() ?? null,
        timezone,
      });
      const beginState = await idempotencyService.begin(
        userId,
        "check-in",
        resolvedRequestId,
        payloadHash,
      );
      if (beginState === "completed") {
        const replayPayload = await idempotencyService.getReplay<{
          success: boolean;
          data: unknown;
          message?: string;
          warning?: string;
        }>(userId, "check-in", resolvedRequestId);
        if (replayPayload)
          return NextResponse.json(replayPayload, {
            headers: { "X-Idempotent-Replay": "true" },
          });
      }
      if (beginState === "hash-mismatch")
        return apiError(
          "Idempotency key sudah digunakan untuk payload berbeda",
          ErrorCodes.CONFLICT,
          { status: 409 },
        );
      if (beginState === "in-progress")
        return apiError(
          "Permintaan check-in sedang diproses",
          ErrorCodes.CONFLICT,
          { status: 409 },
        );
    }

    const result = await attendanceService.checkIn({
      userId,
      photoUrl,
      location,
      notes,
      timezone,
      tenantId,
      latitude,
      longitude,
      offlineTime: offlineCapturedAt,
    });

    const responsePayload = {
      success: true,
      data: {
        ...result.attendance,
        ...result.evaluation,
        canonical: result.evaluation,
      },
    };

    if (resolvedRequestId && payloadHash) {
      await idempotencyService.complete(
        userId,
        "check-in",
        resolvedRequestId,
        payloadHash,
        responsePayload,
      );
    }

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    if (userId && resolvedRequestId) {
      const idempotencyService = new AttendanceIdempotencyService();
      await idempotencyService.release(userId, "check-in", resolvedRequestId);
    }

    if (error instanceof Error) {
      if (error.message === "OUTSIDE_GEOFENCE")
        return apiError(
          "Anda berada di luar area absensi yang diizinkan",
          ErrorCodes.OUTSIDE_GEOFENCE,
          { status: 400 },
        );
      if (error.message === "DUPLICATE_ENTRY")
        return apiError(
          "Anda sudah melakukan check-in hari ini",
          ErrorCodes.ALREADY_CHECKED_IN,
          { status: 400 },
        );
      if (error.message.startsWith("CHECKIN_REJECTED:")) {
        const reason = error.message.split(":")[1];
        return apiError(
          `Check-in ditolak: ${reason}`,
          ErrorCodes.VALIDATION_ERROR,
          { status: 400, details: { reason } },
        );
      }
    }

    throw error; // Caught by createHandler
  }
});
