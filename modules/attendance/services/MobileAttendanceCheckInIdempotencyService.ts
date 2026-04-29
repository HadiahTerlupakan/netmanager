import { logger } from "@/lib/logger";
import { ErrorCodes, type ErrorCode } from "@/lib/api";
import type { AttendanceIdempotencyService } from "./AttendanceIdempotencyService";
import type {
  MobileAttendanceCheckInRouteFailure,
  MobileAttendanceCheckInRouteSuccess,
  MobileCheckInParsedPayload,
} from "./MobileAttendanceCheckInTypes";

const CHECK_IN_ACTION = "check-in";

type IdempotencyBeginRouteResult =
  | {
      success: true;
      payloadHash: string | null;
      replay?: MobileAttendanceCheckInRouteSuccess;
    }
  | MobileAttendanceCheckInRouteFailure;

export class MobileAttendanceCheckInIdempotencyService {
  constructor(
    private readonly idempotency: Pick<
      AttendanceIdempotencyService,
      | "resolveRequestId"
      | "buildPayloadHash"
      | "begin"
      | "getReplay"
      | "complete"
      | "release"
    >,
  ) {}

  /** Resolve request idempotency key dari header atau body. */
  resolveRequestId(request: Request, payload: MobileCheckInParsedPayload) {
    return this.idempotency.resolveRequestId(
      request.headers.get("Idempotency-Key") ??
        request.headers.get("idempotency-key"),
      payload.bodyRequestId,
    );
  }

  /** Mulai proses idempotency check-in dan kembalikan replay jika tersedia. */
  async begin(input: {
    userId: string;
    resolvedRequestId: string | null;
    payload: MobileCheckInParsedPayload;
    timezone: string;
  }): Promise<IdempotencyBeginRouteResult> {
    if (!input.resolvedRequestId) return { success: true, payloadHash: null };

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
      if (replay) return { success: true, payloadHash, replay };
    }
    if (beginState === "started") return { success: true, payloadHash };
    return this.mapBeginState(beginState);
  }

  /** Simpan response idempotency untuk replay berikutnya. */
  async complete(input: {
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

  /** Release idempotency lock ketika proses check-in gagal. */
  async release(userId: string, requestId: string | null) {
    if (!requestId) return;
    await this.idempotency.release(userId, CHECK_IN_ACTION, requestId);
  }

  private async getReplay(userId: string, requestId: string) {
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

  private mapBeginState(
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

  private fail(
    error: string,
    code: ErrorCode,
    status: number,
  ): MobileAttendanceCheckInRouteFailure {
    return { success: false, status, code, error };
  }
}
