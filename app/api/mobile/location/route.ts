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

const batchLocationSchema = z.object({
  locations: z.array(locationSchema),
});

/**
 * POST /api/mobile/location
 * Menerima update lokasi dari mobile app
 * Hanya menyimpan jika user sedang dalam status check-in
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
    const body = await request.json();

    const locationService = new LocationTrackingService();

    // Cek apakah user sedang check-in
    const isCheckedIn = await locationService.isUserCurrentlyCheckedIn(userId);

    if (!isCheckedIn) {
      return apiSuccess(
        { shouldStopTracking: true },
        { message: "User belum melakukan check-in" },
      );
    }

    // Handle batch locations (offline sync)
    if (Array.isArray(body.locations)) {
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
          recordedAt: loc.recordedAt ? new Date(loc.recordedAt) : new Date(),
        })),
      );

      return apiSuccess({ count }, { message: `Saved ${count} locations` });
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
      recordedAt: parsed.data.recordedAt
        ? new Date(parsed.data.recordedAt)
        : new Date(),
    });

    return apiSuccess(null, { message: "Lokasi tersimpan" });
  } catch (error: unknown) {
    console.error(`[API][${timestamp}] ❌ Error saving location:`, error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
