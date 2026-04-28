import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getLogoSettings } from "@/modules/settings";

/**
 * GET /api/settings/logo/public
 * Mengambil pengaturan logo untuk public access (invoice)
 */
export async function GET(_req: NextRequest) {
  try {
    const settings = await getLogoSettings();
    return NextResponse.json(settings);
  } catch (error) {
    logger.error("Error fetching logo settings:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
