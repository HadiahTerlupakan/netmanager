import { AttendanceService } from "./AttendanceService";
import { AttendanceIdempotencyService } from "./AttendanceIdempotencyService";
import { AttendancePhotoService } from "./AttendancePhotoService";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { ErrorCodes, type ErrorCode } from "@/lib/api";
import { MobileAttendanceCheckInIdempotencyService } from "./MobileAttendanceCheckInIdempotencyService";
import { MobileAttendanceCheckInPayloadParser } from "./MobileAttendanceCheckInPayloadParser";
import type {
  MobileAttendanceCheckInDependencies,
  MobileAttendanceCheckInRouteFailure,
  MobileAttendanceCheckInRouteResult,
  MobileCheckInParsedPayload,
  MobileCheckInRouteInput,
} from "./MobileAttendanceCheckInTypes";
import { logger } from "@/lib/logger";
export type {
  MobileAttendanceCheckInRouteFailure,
  MobileAttendanceCheckInRouteResult,
  MobileAttendanceCheckInRouteSuccess,
  MobileCheckInRouteInput,
} from "./MobileAttendanceCheckInTypes";

export class MobileAttendanceCheckInRouteService {
  private readonly attendance: Pick<AttendanceService, "checkIn">;
  private readonly idempotency: Pick<
    AttendanceIdempotencyService,
    | "resolveRequestId"
    | "buildPayloadHash"
    | "begin"
    | "getReplay"
    | "complete"
    | "release"
  >;
  private readonly timezone: Pick<AttendanceTimezoneService, "getTimezone">;
  private readonly photo: Pick<AttendancePhotoService, "processPhoto">;
  private readonly payloadParser: MobileAttendanceCheckInPayloadParser;
  private readonly idempotencyService: MobileAttendanceCheckInIdempotencyService;

  constructor(dependencies: MobileAttendanceCheckInDependencies = {}) {
    this.attendance = dependencies.attendance ?? new AttendanceService();
    this.idempotency =
      dependencies.idempotency ?? new AttendanceIdempotencyService();
    this.timezone = dependencies.timezone ?? new AttendanceTimezoneService();
    this.photo = dependencies.photo ?? new AttendancePhotoService();
    this.payloadParser = new MobileAttendanceCheckInPayloadParser(this.photo);
    this.idempotencyService = new MobileAttendanceCheckInIdempotencyService(
      this.idempotency,
    );
  }

  /** Proses check-in mobile dari request JSON atau multipart. */
  async checkIn(
    input: MobileCheckInRouteInput,
  ): Promise<MobileAttendanceCheckInRouteResult> {
    const userId = input.user.id;
    let resolvedRequestId: string | null = null;

    try {
      logger.info("MobileCheckInRouteService: Starting check-in", {
        userId,
        tenantId: input.user.tenantId,
      });

      const timezone = await this.timezone.getTimezone(
        input.user.tenantId as string,
      );
      logger.info("MobileCheckInRouteService: Timezone resolved", {
        userId,
        timezone,
      });

      const parsedPayload = await this.payloadParser.parsePayload(
        input.request,
        userId,
      );
      if (!parsedPayload.success) {
        logger.warn("MobileCheckInRouteService: Payload parsing failed", {
          userId,
          errorDetails: parsedPayload,
        });
        return parsedPayload;
      }

      logger.info("MobileCheckInRouteService: Payload parsed successfully", {
        userId,
        hasPhotoUrl: !!parsedPayload.data.photoUrl,
        hasCoordinates: !!(
          parsedPayload.data.latitude && parsedPayload.data.longitude
        ),
        hasOfflineTime: !!parsedPayload.data.offlineCapturedAt,
      });

      const payload = parsedPayload.data;
      resolvedRequestId = this.idempotencyService.resolveRequestId(
        input.request,
        payload,
      );
      const idempotencyResult = await this.idempotencyService.begin({
        userId,
        resolvedRequestId,
        payload,
        timezone,
      });
      if (this.isFailure(idempotencyResult)) return idempotencyResult;
      if (idempotencyResult.replay) return idempotencyResult.replay;

      const responsePayload = await this.performCheckIn({
        userId,
        tenantId: input.user.tenantId as string,
        timezone,
        payload,
      });

      await this.idempotencyService.complete({
        userId,
        resolvedRequestId,
        payloadHash: idempotencyResult.payloadHash,
        responsePayload,
      });

      logger.info("MobileCheckInRouteService: Check-in completed", {
        userId,
      });

      return { success: true, data: responsePayload };
    } catch (error) {
      await this.idempotencyService.release(userId, resolvedRequestId);

      logger.error("MobileCheckInRouteService: Check-in error", {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        resolvedRequestId,
      });

      return this.mapCheckInError(error);
    }
  }

  private async performCheckIn(input: {
    userId: string;
    tenantId: string;
    timezone: string;
    payload: MobileCheckInParsedPayload;
  }) {
    const result = await this.attendance.checkIn({
      userId: input.userId,
      photoUrl: input.payload.photoUrl,
      location: input.payload.location,
      notes: input.payload.notes,
      timezone: input.timezone,
      tenantId: input.tenantId,
      latitude: input.payload.latitude,
      longitude: input.payload.longitude,
      offlineTime: input.payload.offlineCapturedAt,
    });

    return {
      success: true,
      data: {
        ...result.attendance,
        ...result.evaluation,
        canonical: result.evaluation,
      },
    };
  }

  private isFailure(result: {
    success: boolean;
  }): result is MobileAttendanceCheckInRouteFailure {
    return !result.success;
  }

  private mapCheckInError(error: unknown): MobileAttendanceCheckInRouteResult {
    if (!(error instanceof Error)) throw error;

    if (error.message === "OUTSIDE_GEOFENCE") {
      return this.fail(
        "Anda berada di luar area absensi yang diizinkan",
        ErrorCodes.OUTSIDE_GEOFENCE,
        400,
      );
    }
    if (error.message === "DUPLICATE_ENTRY") {
      return this.fail(
        "Anda sudah melakukan check-in hari ini",
        ErrorCodes.ALREADY_CHECKED_IN,
        400,
      );
    }
    if (error.message.startsWith("CHECKIN_REJECTED:")) {
      const reason = error.message.split(":")[1];
      return this.fail(
        `Check-in ditolak: ${reason}`,
        ErrorCodes.VALIDATION_ERROR,
        400,
        {
          reason,
        },
      );
    }

    logger.error(
      "MobileCheckInRouteService: Unhandled error in mapCheckInError",
      {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
      },
    );

    throw error;
  }

  private fail(
    error: string,
    code: ErrorCode,
    status: number,
    details?: Record<string, unknown>,
  ): MobileAttendanceCheckInRouteFailure {
    return {
      success: false,
      status,
      code,
      error,
      ...(details ? { details } : {}),
    };
  }
}

const getMobileAttendanceCheckInRouteService = (() => {
  let instance: MobileAttendanceCheckInRouteService;
  return () => (instance ??= new MobileAttendanceCheckInRouteService());
})();

export const mobileAttendanceCheckInRouteService = {
  checkIn(input: MobileCheckInRouteInput) {
    return getMobileAttendanceCheckInRouteService().checkIn(input);
  },
};
