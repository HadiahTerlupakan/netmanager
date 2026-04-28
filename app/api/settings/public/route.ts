import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getPublicPortalSettings } from "@/modules/settings";

/**
 * GET /api/settings/public
 * Public endpoint for settings needed by external portals (employee portal)
 * No authentication required
 */
export async function GET(_request: NextRequest) {
  try {
    const settings = await getPublicPortalSettings();

    return NextResponse.json({
      success: true,
      data: {
        namaAplikasi: settings.namaAplikasi,
        perusahaan: settings.perusahaan,
        appLogoUrl: settings.appLogoUrl,
        logoInvoice: settings.logoInvoice,
        landingLogoUrl: settings.landingLogoUrl,
      },
    });
  } catch (error) {
    logger.error("[API] Get public settings error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat pengaturan" },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
