import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { LocationTrackingService } from "@/modules/attendance";
import * as z from "zod";

// Validasi input lokasi menggunakan Zod
const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional().nullable(),
  altitude: z.number().optional().nullable(),
  speed: z.number().optional().nullable(),
  heading: z.number().optional().nullable(),
  batteryLevel: z.number().optional().nullable(),
  isMoving: z.boolean().optional().default(false),
  recordedAt: z.iso.datetime().optional(),
});

/** Antrean offline di HP dibatasi 100 titik; ruang dua kali lipat untuk versi lama. */
const MAX_BATCH_LOCATIONS = 200;

/** Jam HP boleh lebih cepat dari server sebanyak ini sebelum dianggap salah. */
const MAX_CLOCK_AHEAD_MS = 15 * 60 * 1000;

const batchLocationSchema = z.object({
  locations: z.array(locationSchema).max(MAX_BATCH_LOCATIONS),
});

/**
 * Waktu rekam titik. Titik dari HP berjam lebih cepat akan menjadi "lokasi
 * terakhir" selamanya dan membekukan marker-nya, jadi waktu yang jauh di depan
 * jam server diganti waktu server.
 */
function resolveRecordedAt(recordedAt: string | undefined): Date {
  const now = new Date();
  if (!recordedAt) return now;
  const parsed = new Date(recordedAt);
  return parsed.getTime() > now.getTime() + MAX_CLOCK_AHEAD_MS ? now : parsed;
}

/**
 * POST /api/mobile/location
 * Menerima update lokasi dari mobile app
 * Titik tunggal hanya disimpan selama sesi kerja berjalan; antrean offline
 * disimpan bila titiknya terekam di dalam salah satu sesi kerja.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.userId as string;
    if (!userId) {
      return apiError(
        "Token tidak valid atau kadaluarsa",
        ErrorCodes.UNAUTHORIZED,
        { status: 401 },
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Data lokasi tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const locationService = new LocationTrackingService();

    // Antrean offline: disaring per sesi kerja di service, tidak digerbang
    // status check-in saat ini karena biasanya terkirim sesudah check-out.
    if (
      typeof body === "object" &&
      body !== null &&
      "locations" in body &&
      Array.isArray(body.locations)
    ) {
      const parsed = batchLocationSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(
          "Data lokasi tidak valid",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400, details: z.flattenError(parsed.error) },
        );
      }

      const count = await locationService.saveLocations(
        userId,
        parsed.data.locations.map((loc) => ({
          ...loc,
          recordedAt: resolveRecordedAt(loc.recordedAt),
        })),
      );

      return apiSuccess({ count }, { message: `Saved ${count} locations` });
    }

    const isCheckedIn = await locationService.isUserCurrentlyCheckedIn(userId);
    if (!isCheckedIn) {
      return apiSuccess(
        { shouldStopTracking: true },
        { message: "User belum melakukan check-in" },
      );
    }

    // Handle single location
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data lokasi tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: z.flattenError(parsed.error),
      });
    }

    await locationService.saveLocation(userId, {
      ...parsed.data,
      recordedAt: resolveRecordedAt(parsed.data.recordedAt),
    });

    return apiSuccess(null, { message: "Lokasi tersimpan" });
  } catch (error: unknown) {
    logger.error(`[API][${timestamp}] ❌ Error saving location:`, error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
