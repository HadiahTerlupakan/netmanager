import { logger } from "@/lib/logger";
import { AttendanceService } from "./AttendanceService";
import { AttendanceIdempotencyService } from "./AttendanceIdempotencyService";
import { AttendancePhotoService } from "./AttendancePhotoService";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { ErrorCodes, type ErrorCode } from "@/lib/api";
import { validateCoordinates } from "@/lib/validation-utils";

const CHECK_IN_ACTION = "check-in";
const LOCAL_PHOTO_PATH_PREFIX = "/uploads/";
const TRUSTED_PHOTO_DOMAINS = [
  "cdn.radpro.id",
  "localhost:3000",
  "0.0.0.0:3000",
  "localhost",
];
const LOCAL_NETWORK_HOST_PATTERN =
  /^(192\.168|10|127|172\.(1[6-9]|2[0-9]|3[0-1]))\./;

interface MobileCheckInUser {
  id: string;
  tenantId?: string | null;
}

interface MobileCheckInRouteInput {
  request: Request;
  user: MobileCheckInUser;
}

interface MobileCheckInParsedPayload {
  location: string;
  notes: string;
  bodyRequestId?: string;
  latitude?: number;
  longitude?: number;
  photoUrl: string | null;
  offlineCapturedAt?: Date;
}

interface MobileAttendanceCheckInDependencies {
  attendance?: Pick<AttendanceService, "checkIn">;
  idempotency?: Pick<
    AttendanceIdempotencyService,
    | "resolveRequestId"
    | "buildPayloadHash"
    | "begin"
    | "getReplay"
    | "complete"
    | "release"
  >;
  timezone?: Pick<AttendanceTimezoneService, "getTimezone">;
  photo?: Pick<AttendancePhotoService, "processPhoto">;
}

export type MobileAttendanceCheckInRouteSuccess = {
  success: true;
  data: unknown;
  idempotentReplay?: boolean;
};

export type MobileAttendanceCheckInRouteFailure = {
  success: false;
  status: number;
  code: ErrorCode;
  error: string;
  details?: Record<string, unknown>;
};

type ParsedPayloadResult =
  | { success: true; data: MobileCheckInParsedPayload }
  | MobileAttendanceCheckInRouteFailure;

type ParsedCoordinatesResult =
  | { success: true; latitude?: number; longitude?: number }
  | MobileAttendanceCheckInRouteFailure;

type ParsedCapturedAtResult =
  | { success: true; data?: Date }
  | MobileAttendanceCheckInRouteFailure;

type ParsedPhotoUrlResult =
  | { success: true; data: string | null }
  | MobileAttendanceCheckInRouteFailure;

type IdempotencyBeginRouteResult =
  | {
      success: true;
      payloadHash: string | null;
      replay?: MobileAttendanceCheckInRouteSuccess;
    }
  | MobileAttendanceCheckInRouteFailure;

export type MobileAttendanceCheckInRouteResult =
  | MobileAttendanceCheckInRouteSuccess
  | MobileAttendanceCheckInRouteFailure;

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

  constructor(dependencies: MobileAttendanceCheckInDependencies = {}) {
    this.attendance = dependencies.attendance ?? new AttendanceService();
    this.idempotency =
      dependencies.idempotency ?? new AttendanceIdempotencyService();
    this.timezone = dependencies.timezone ?? new AttendanceTimezoneService();
    this.photo = dependencies.photo ?? new AttendancePhotoService();
  }

  /** Proses check-in mobile dari request JSON atau multipart. */
  async checkIn(
    input: MobileCheckInRouteInput,
  ): Promise<MobileAttendanceCheckInRouteResult> {
    const userId = input.user.id;
    let resolvedRequestId: string | null = null;

    try {
      const timezone = await this.timezone.getTimezone(
        input.user.tenantId as string,
      );
      const parsedPayload = await this.parsePayload(input.request, userId);
      if (!parsedPayload.success) return parsedPayload;

      const payload = parsedPayload.data;
      resolvedRequestId = this.resolveRequestId(input.request, payload);
      const idempotencyResult = await this.beginIdempotency({
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

      await this.completeIdempotency({
        userId,
        resolvedRequestId,
        payloadHash: idempotencyResult.payloadHash,
        responsePayload,
      });

      return { success: true, data: responsePayload };
    } catch (error) {
      if (resolvedRequestId) {
        await this.idempotency.release(
          userId,
          CHECK_IN_ACTION,
          resolvedRequestId,
        );
      }

      return this.mapCheckInError(error);
    }
  }

  private async parsePayload(
    request: Request,
    userId: string,
  ): Promise<ParsedPayloadResult> {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      return this.parseMultipartPayload(request, userId);
    }
    if (contentType.includes("application/json")) {
      return this.parseJsonPayload(request);
    }

    return {
      success: true,
      data: { location: "", notes: "", photoUrl: null },
    };
  }

  private async parseMultipartPayload(
    request: Request,
    userId: string,
  ): Promise<ParsedPayloadResult> {
    const formData = await request.formData();
    const coordinates = this.parseCoordinates(
      formData.get("latitude") as string | null,
      formData.get("longitude") as string | null,
    );
    if (this.isFailure(coordinates)) return coordinates;

    const photo = formData.get("photo") as File | null;
    const photoUrl = photo
      ? await this.photo.processPhoto(photo, userId, "checkin")
      : null;
    const requestIdValue = formData.get("requestId");

    return {
      success: true,
      data: {
        location: (formData.get("location") as string) || "",
        notes: (formData.get("notes") as string) || "",
        bodyRequestId:
          typeof requestIdValue === "string" ? requestIdValue : undefined,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        photoUrl,
      },
    };
  }

  private async parseJsonPayload(
    request: Request,
  ): Promise<ParsedPayloadResult> {
    const body = await request.json();
    const offlineCapturedAt = this.parseCapturedAt(body.capturedAt);
    if (this.isFailure(offlineCapturedAt)) return offlineCapturedAt;

    const coordinates = this.parseCoordinates(body.latitude, body.longitude);
    if (this.isFailure(coordinates)) return coordinates;

    const photoUrl = this.resolvePhotoUrl(
      body.photoUrl,
      request.headers.get("host"),
    );
    if (this.isFailure(photoUrl)) return photoUrl;

    return {
      success: true,
      data: {
        location: body.location || "",
        notes: body.notes || "",
        bodyRequestId: body.requestId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        photoUrl: photoUrl.data,
        offlineCapturedAt: offlineCapturedAt.data,
      },
    };
  }

  private parseCoordinates(
    latitude: unknown,
    longitude: unknown,
  ): ParsedCoordinatesResult {
    const validation = validateCoordinates(
      latitude as never,
      longitude as never,
    );
    if (!validation.valid) {
      return this.fail(
        validation.error ?? "Koordinat tidak valid",
        ErrorCodes.INVALID_COORDINATES,
        400,
      );
    }

    return {
      success: true as const,
      latitude: validation.latitude,
      longitude: validation.longitude,
    };
  }

  private parseCapturedAt(capturedAt: unknown): ParsedCapturedAtResult {
    if (typeof capturedAt !== "string") {
      return { success: true as const, data: undefined };
    }

    const parsedCapturedAt = new Date(capturedAt);
    if (Number.isNaN(parsedCapturedAt.getTime())) {
      return this.fail(
        "Format capturedAt tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    return { success: true as const, data: parsedCapturedAt };
  }

  private resolvePhotoUrl(
    photoUrl: unknown,
    host: string | null,
  ): ParsedPhotoUrlResult {
    if (!photoUrl) return { success: true as const, data: null };
    if (typeof photoUrl !== "string") {
      return this.fail(
        "Photo URL tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (photoUrl.startsWith(LOCAL_PHOTO_PATH_PREFIX)) {
      return { success: true as const, data: photoUrl };
    }

    return this.validateTrustedPhotoUrl(photoUrl, host);
  }

  private validateTrustedPhotoUrl(
    photoUrl: string,
    host: string | null,
  ): ParsedPhotoUrlResult {
    const trustedDomains = [...TRUSTED_PHOTO_DOMAINS];
    if (host) {
      trustedDomains.push(host, host.split(":")[0]);
    }

    try {
      const url = new URL(photoUrl);
      if (this.isTrustedPhotoHost(url, trustedDomains)) {
        return { success: true as const, data: photoUrl };
      }

      return this.fail(
        "Photo URL tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    } catch {
      return this.fail(
        "Format Photo URL tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private isTrustedPhotoHost(url: URL, trustedDomains: string[]) {
    const isLocalIP =
      process.env.NODE_ENV !== "production" &&
      LOCAL_NETWORK_HOST_PATTERN.test(url.hostname);

    return (
      isLocalIP ||
      trustedDomains.some(
        (domain) =>
          url.host === domain ||
          url.hostname === domain ||
          url.host.endsWith(`.${domain}`),
      )
    );
  }

  private resolveRequestId(
    request: Request,
    payload: MobileCheckInParsedPayload,
  ) {
    return this.idempotency.resolveRequestId(
      request.headers.get("Idempotency-Key") ??
        request.headers.get("idempotency-key"),
      payload.bodyRequestId,
    );
  }

  private async beginIdempotency(input: {
    userId: string;
    resolvedRequestId: string | null;
    payload: MobileCheckInParsedPayload;
    timezone: string;
  }): Promise<IdempotencyBeginRouteResult> {
    if (!input.resolvedRequestId) {
      return { success: true as const, payloadHash: null };
    }

    const payloadHash = this.idempotency.buildPayloadHash({
      location: input.payload.location,
      notes: input.payload.notes,
      latitude: input.payload.latitude,
      longitude: input.payload.longitude,
      photoUrl: input.payload.photoUrl,
      offlineTime: input.payload.offlineCapturedAt?.toISOString() ?? null,
      timezone: input.timezone,
    });
    const beginState = await this.idempotency.begin(
      input.userId,
      CHECK_IN_ACTION,
      input.resolvedRequestId,
      payloadHash,
    );

    if (beginState === "completed") {
      const replay = await this.getReplay(
        input.userId,
        input.resolvedRequestId,
      );
      if (replay) return { success: true as const, payloadHash, replay };
    }
    if (beginState === "started")
      return { success: true as const, payloadHash };
    return this.mapIdempotencyBeginState(beginState);
  }

  private async getReplay(
    userId: string,
    requestId: string,
  ): Promise<MobileAttendanceCheckInRouteSuccess | null> {
    const replayPayload = await this.idempotency.getReplay(
      userId,
      CHECK_IN_ACTION,
      requestId,
    );
    if (!replayPayload) return null;

    return {
      success: true as const,
      data: replayPayload,
      idempotentReplay: true as const,
    };
  }

  private mapIdempotencyBeginState(
    beginState: string,
  ): MobileAttendanceCheckInRouteFailure {
    if (beginState === "unavailable") {
      return this.fail(
        "Layanan absensi sementara tidak tersedia. Coba lagi beberapa saat.",
        ErrorCodes.INTERNAL_ERROR,
        503,
      );
    }
    if (beginState === "hash-mismatch") {
      return this.fail(
        "Idempotency key sudah digunakan untuk payload berbeda",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    return this.fail(
      "Permintaan check-in sedang diproses",
      ErrorCodes.CONFLICT,
      409,
    );
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

  private async completeIdempotency(input: {
    userId: string;
    resolvedRequestId: string | null;
    payloadHash: string | null;
    responsePayload: unknown;
  }) {
    if (!input.resolvedRequestId || !input.payloadHash) return;

    try {
      await this.idempotency.complete(
        input.userId,
        CHECK_IN_ACTION,
        input.resolvedRequestId,
        input.payloadHash,
        input.responsePayload,
      );
    } catch (finalizeError) {
      const message =
        finalizeError instanceof Error
          ? finalizeError.message
          : String(finalizeError);
      logger.error(
        `[AttendanceIdempotency] Failed to finalize check-in key "${input.resolvedRequestId}": ${message}`,
      );
    }
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

let mobileAttendanceCheckInRouteServiceInstance:
  | MobileAttendanceCheckInRouteService
  | undefined;

function getMobileAttendanceCheckInRouteService() {
  mobileAttendanceCheckInRouteServiceInstance ??=
    new MobileAttendanceCheckInRouteService();
  return mobileAttendanceCheckInRouteServiceInstance;
}

export const mobileAttendanceCheckInRouteService = {
  checkIn(input: MobileCheckInRouteInput) {
    return getMobileAttendanceCheckInRouteService().checkIn(input);
  },
};
