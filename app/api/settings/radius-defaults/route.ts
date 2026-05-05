import { NextResponse } from "next/server";

import { getRadiusDefaultPorts } from "@/modules/network";

/**
 * GET /api/settings/radius-defaults
 *
 * Mengembalikan konfigurasi port default RADIUS untuk form MikroTik.
 */
export async function GET() {
  return NextResponse.json(getRadiusDefaultPorts());
}
