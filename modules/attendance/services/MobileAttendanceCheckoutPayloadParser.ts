import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api";
import { validateCoordinates } from "@/lib/validation-utils";
import { AttendancePhotoService } from "./AttendancePhotoService";

export type MobileCheckoutPayload = {
  bodyRequestId?: string;
  photoUrl: string | null;
  notes: string;
  location: string;
  latitude?: number;
  longitude?: number;
  offlineTime?: Date;
};

export class MobileAttendanceCheckoutPayloadParser {
  constructor(private readonly photoService = new AttendancePhotoService()) {}

  /** Parse mobile check-out request into a normalized payload. */
  async parse(request: NextRequest, userId: string) {
    const contentType = request.headers.get("content-type") || "";
    return contentType.includes("application/json")
      ? this.parseJsonPayload(request)
      : this.parseFormPayload(request, userId);
  }

  private async parseJsonPayload(request: NextRequest) {
    const body = await request.json();
    const payload: MobileCheckoutPayload = {
      location: body.location,
      notes: body.notes,
      bodyRequestId: body.requestId,
      photoUrl: null,
    };

    if (typeof body.capturedAt === "string") {
      payload.offlineTime = this.parseCapturedAt(body.capturedAt);
    }
    if (body.photoUrl)
      payload.photoUrl = this.parsePhotoUrl(body.photoUrl, request);
    if (body.latitude !== undefined && body.longitude !== undefined) {
      Object.assign(
        payload,
        this.parseCoordinates(body.latitude, body.longitude),
      );
    }

    return payload;
  }

  private async parseFormPayload(request: NextRequest, userId: string) {
    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;
    const payload: MobileCheckoutPayload = {
      photoUrl: photo
        ? await this.photoService.processPhoto(photo, userId, "checkout")
        : null,
      notes: (formData.get("notes") as string) || "",
      location: (formData.get("location") as string) || "",
      bodyRequestId:
        typeof formData.get("requestId") === "string"
          ? (formData.get("requestId") as string)
          : undefined,
    };
    const latStr = formData.get("latitude") as string;
    const lngStr = formData.get("longitude") as string;

    if (latStr && lngStr) {
      Object.assign(payload, this.parseCoordinates(latStr, lngStr));
    }

    return payload;
  }

  private parseCapturedAt(capturedAt: string) {
    const parsedCapturedAt = new Date(capturedAt);
    if (Number.isNaN(parsedCapturedAt.getTime())) {
      throw apiError(
        "Format capturedAt tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        {
          status: 400,
        },
      );
    }

    return parsedCapturedAt;
  }

  private parseCoordinates(
    latitude: number | string | undefined | null,
    longitude: number | string | undefined | null,
  ) {
    const coordValidation = validateCoordinates(latitude, longitude);
    if (!coordValidation.valid) {
      throw apiError(
        coordValidation.error ?? "Koordinat tidak valid",
        ErrorCodes.INVALID_COORDINATES,
        { status: 400 },
      );
    }

    return {
      latitude: coordValidation.latitude,
      longitude: coordValidation.longitude,
    };
  }

  private parsePhotoUrl(photoUrl: string, request: NextRequest) {
    if (photoUrl.startsWith("/uploads/")) return photoUrl;

    try {
      const url = new URL(photoUrl);
      if (this.isTrustedPhotoUrl(url, request.headers.get("host")))
        return photoUrl;
      throw apiError("Photo URL tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    } catch (error) {
      if (error instanceof NextResponse) throw error;
      throw apiError(
        "Format Photo URL tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        {
          status: 400,
        },
      );
    }
  }

  private isTrustedPhotoUrl(url: URL, host: string | null) {
    const trustedDomains = this.buildTrustedDomains(host);
    const isLocalIP =
      process.env.NODE_ENV !== "production" &&
      /^(192\.168|10|127|172\.(1[6-9]|2[0-9]|3[0-1]))\./.test(url.hostname);

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

  private buildTrustedDomains(host: string | null) {
    const trustedDomains = [
      "cdn.radpro.id",
      "localhost:3000",
      "0.0.0.0:3000",
      "localhost",
    ];
    if (host) trustedDomains.push(host, host.split(":")[0] || host);

    return trustedDomains;
  }
}
