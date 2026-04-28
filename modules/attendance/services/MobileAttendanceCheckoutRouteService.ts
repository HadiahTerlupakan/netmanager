import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api";
import { AttendanceIdempotencyService } from "./AttendanceIdempotencyService";
import { AttendanceService } from "./AttendanceService";
import {
  MobileAttendanceCheckoutPayloadParser,
  type MobileCheckoutPayload,
} from "./MobileAttendanceCheckoutPayloadParser";

const CHECKOUT_OPERATION = "check-out";

export class MobileAttendanceCheckoutRouteService {
  constructor(
    private readonly attendanceService = new AttendanceService(),
    private readonly idempotencyService = new AttendanceIdempotencyService(),
    private readonly payloadParser = new MobileAttendanceCheckoutPayloadParser(),
  ) {}

  /** Handle mobile attendance check-out request orchestration. */
  async checkOut(request: NextRequest, userId: string, tenantId: string) {
    let resolvedRequestId: string | null = null;

    try {
      const payload = await this.payloadParser.parse(request, userId);
      resolvedRequestId = this.resolveRequestId(request, payload);
      const payloadHash = this.buildPayloadHash(payload);
      const replay = await this.beginIdempotency(
        userId,
        resolvedRequestId,
        payloadHash,
      );
      if (replay) return replay;

      const responsePayload = await this.performCheckout(
        userId,
        tenantId,
        payload,
      );
      await this.completeIdempotency(
        userId,
        resolvedRequestId,
        payloadHash,
        responsePayload,
      );
      return NextResponse.json(responsePayload);
    } catch (error: unknown) {
      await this.releaseIdempotency(userId, resolvedRequestId);
      if (error instanceof NextResponse) return error;
      throw error;
    }
  }

  private resolveRequestId(
    request: NextRequest,
    payload: MobileCheckoutPayload,
  ) {
    return this.idempotencyService.resolveRequestId(
      request.headers.get("Idempotency-Key") ??
        request.headers.get("idempotency-key"),
      payload.bodyRequestId,
    );
  }

  private buildPayloadHash(payload: MobileCheckoutPayload) {
    return this.idempotencyService.buildPayloadHash({
      location: payload.location,
      notes: payload.notes,
      latitude: payload.latitude,
      longitude: payload.longitude,
      photoUrl: payload.photoUrl,
      offlineTime: payload.offlineTime?.toISOString() ?? null,
    });
  }

  private async beginIdempotency(
    userId: string,
    requestId: string | null,
    payloadHash: string,
  ) {
    if (!requestId) return null;

    const beginState = await this.idempotencyService.begin(
      userId,
      CHECKOUT_OPERATION,
      requestId,
      payloadHash,
    );
    if (beginState === "completed") {
      return this.getReplayResponse(userId, requestId);
    }
    if (beginState === "unavailable") {
      throw apiError(
        "Layanan absensi sementara tidak tersedia. Coba lagi beberapa saat.",
        ErrorCodes.INTERNAL_ERROR,
        { status: 503 },
      );
    }
    if (beginState === "hash-mismatch") {
      throw apiError(
        "Idempotency key sudah digunakan untuk payload berbeda",
        ErrorCodes.CONFLICT,
        { status: 409 },
      );
    }
    if (beginState === "in-progress") {
      throw apiError(
        "Permintaan check-out sedang diproses",
        ErrorCodes.CONFLICT,
        {
          status: 409,
        },
      );
    }

    return null;
  }

  private async getReplayResponse(userId: string, requestId: string) {
    const replayPayload = await this.idempotencyService.getReplay(
      userId,
      CHECKOUT_OPERATION,
      requestId,
    );
    return replayPayload
      ? NextResponse.json(replayPayload, {
          headers: { "X-Idempotent-Replay": "true" },
        })
      : null;
  }

  private async performCheckout(
    userId: string,
    tenantId: string,
    payload: MobileCheckoutPayload,
  ) {
    try {
      const result = await this.attendanceService.checkOut({
        userId,
        photoUrl: payload.photoUrl,
        location: payload.location,
        notes: payload.notes,
        tenantId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        offlineTime: payload.offlineTime,
      });

      return {
        success: true,
        data: {
          ...result.attendance,
          ...result.evaluation,
          canonical: result.evaluation,
        },
        ...(result.warning
          ? { warning: result.warning, message: result.warning }
          : {}),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "OUTSIDE_GEOFENCE") {
        throw apiError(
          "Anda berada di luar area absensi yang diizinkan",
          ErrorCodes.OUTSIDE_GEOFENCE,
          { status: 400 },
        );
      }
      if (error instanceof Error && error.message === "NO_ACTIVE_SESSION") {
        throw apiError(
          "Anda belum melakukan check-in atau sudah check-out hari ini",
          ErrorCodes.NO_ACTIVE_SESSION,
          { status: 400 },
        );
      }
      throw error;
    }
  }

  private async completeIdempotency(
    userId: string,
    requestId: string | null,
    payloadHash: string,
    responsePayload: unknown,
  ) {
    if (!requestId) return;

    try {
      await this.idempotencyService.complete(
        userId,
        CHECKOUT_OPERATION,
        requestId,
        payloadHash,
        responsePayload,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `[AttendanceIdempotency] Failed to finalize check-out key "${requestId}": ${message}`,
      );
    }
  }

  private async releaseIdempotency(userId: string, requestId: string | null) {
    if (!requestId) return;
    await this.idempotencyService.release(
      userId,
      CHECKOUT_OPERATION,
      requestId,
    );
  }
}
