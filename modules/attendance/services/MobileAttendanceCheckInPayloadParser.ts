import { ErrorCodes, type ErrorCode } from "@/lib/api";
import { validateCoordinates } from "@/lib/validation-utils";
import type { AttendancePhotoService } from "./AttendancePhotoService";
import type {
  MobileAttendanceCheckInRouteFailure,
  ParsedPayloadResult,
} from "./MobileAttendanceCheckInTypes";

const LOCAL_PHOTO_PATH_PREFIX = "/uploads/";
const TRUSTED_PHOTO_DOMAINS = [
  "cdn.radpro.id",
  "localhost:3000",
  "0.0.0.0:3000",
  "localhost",
];
const LOCAL_NETWORK_HOST_PATTERN =
  /^(192\.168|10|127|172\.(1[6-9]|2[0-9]|3[0-1]))\./;

type ParsedCoordinatesResult = {
  error?: MobileAttendanceCheckInRouteFailure;
  latitude?: number;
  longitude?: number;
};

type ParsedCapturedAtResult = {
  error?: MobileAttendanceCheckInRouteFailure;
  data?: Date;
};

type ParsedPhotoUrlResult = {
  error?: MobileAttendanceCheckInRouteFailure;
  data: string | null;
};

export class MobileAttendanceCheckInPayloadParser {
  constructor(
    private readonly photo: Pick<AttendancePhotoService, "processPhoto">,
  ) {}

  /** Parse payload check-in mobile dari JSON atau multipart. */
  async parsePayload(
    request: Request,
    userId: string,
  ): Promise<ParsedPayloadResult> {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data"))
      return this.parseMultipartPayload(request, userId);
    if (contentType.includes("application/json"))
      return this.parseJsonPayload(request);
    return { success: true, data: { location: "", notes: "", photoUrl: null } };
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
    if (coordinates.error) return coordinates.error;

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
    if (offlineCapturedAt.error) return offlineCapturedAt.error;

    const coordinates = this.parseCoordinates(body.latitude, body.longitude);
    if (coordinates.error) return coordinates.error;

    const photoUrl = this.resolvePhotoUrl(
      body.photoUrl,
      request.headers.get("host"),
    );
    if (photoUrl.error) return photoUrl.error;

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
      return {
        error: this.fail(
          validation.error ?? "Koordinat tidak valid",
          ErrorCodes.INVALID_COORDINATES,
          400,
        ),
      };
    }
    return { latitude: validation.latitude, longitude: validation.longitude };
  }

  private parseCapturedAt(capturedAt: unknown): ParsedCapturedAtResult {
    if (typeof capturedAt !== "string") return {};
    const parsedCapturedAt = new Date(capturedAt);
    if (Number.isNaN(parsedCapturedAt.getTime())) {
      return {
        error: this.fail(
          "Format capturedAt tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          400,
        ),
      };
    }
    return { data: parsedCapturedAt };
  }

  private resolvePhotoUrl(
    photoUrl: unknown,
    host: string | null,
  ): ParsedPhotoUrlResult {
    if (!photoUrl) return { data: null };
    if (typeof photoUrl !== "string") {
      return {
        error: this.fail(
          "Photo URL tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          400,
        ),
        data: null,
      };
    }
    if (photoUrl.startsWith(LOCAL_PHOTO_PATH_PREFIX)) return { data: photoUrl };
    return this.validateTrustedPhotoUrl(photoUrl, host);
  }

  private validateTrustedPhotoUrl(
    photoUrl: string,
    host: string | null,
  ): ParsedPhotoUrlResult {
    const trustedDomains = [...TRUSTED_PHOTO_DOMAINS];
    if (host) trustedDomains.push(host, host.split(":")[0]);

    try {
      const url = new URL(photoUrl);
      if (this.isTrustedPhotoHost(url, trustedDomains))
        return { data: photoUrl };
      return {
        error: this.fail(
          "Photo URL tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          400,
        ),
        data: null,
      };
    } catch {
      return {
        error: this.fail(
          "Format Photo URL tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          400,
        ),
        data: null,
      };
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

  private fail(
    error: string,
    code: ErrorCode,
    status: number,
  ): MobileAttendanceCheckInRouteFailure {
    return { success: false, status, code, error };
  }
}
