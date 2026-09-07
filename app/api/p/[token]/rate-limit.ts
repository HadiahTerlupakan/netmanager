import { NextRequest, NextResponse } from "next/server";
import { getClientIP, rateLimit } from "@/lib/rate-limit";

/**
 * Pembatasan laju untuk rute publik surat pengesahan.
 *
 * Dibatasi dua sumbu sekaligus: per token dan per IP. Per token menahan
 * penyalahgunaan satu tautan; per IP menahan penebakan token secara massal dari
 * satu sumber.
 */

const MAX_REQUESTS_PER_TOKEN = 20;
const MAX_REQUESTS_PER_IP = 60;

export async function checkRateLimit(
  request: NextRequest,
  token: string,
): Promise<NextResponse | null> {
  const ip = getClientIP(request);

  const withinTokenLimit = rateLimit(
    `pengesahan-token:${token}`,
    MAX_REQUESTS_PER_TOKEN,
  );
  const withinIpLimit = rateLimit(`pengesahan-ip:${ip}`, MAX_REQUESTS_PER_IP);

  if (withinTokenLimit && withinIpLimit) return null;

  return NextResponse.json(
    { success: false, error: "Terlalu banyak permintaan. Coba lagi nanti." },
    { status: 429 },
  );
}
