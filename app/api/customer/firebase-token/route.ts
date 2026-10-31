import { NextRequest, NextResponse } from "next/server";

import { requireCustomerAuth } from "@/lib/customer-auth";
import { auth as firebaseAdminAuth } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";
import { advancedRateLimit } from "@/lib/middleware/advanced-rate-limit";
import { buildCustomerRealtimeClaims } from "@/lib/realtime/firebase-claims";

/**
 * Token custom Firebase untuk realtime portal pelanggan, dari cookie sesi
 * pelanggan. Uid-nya id pelanggan dan klaimnya hanya peran pelanggan, jadi
 * aturan Firestore membuka kanal pelanggan itu sendiri saja.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCustomerAuth(request);
    if (auth.response) return auth.response;

    // Sama dengan rute token mobile: createCustomToken berkuota, dan satu tab
    // yang berputar tidak boleh menghabiskannya untuk semua tenant.
    const rateLimitResponse = await advancedRateLimit(request, {
      maxRequests: 10,
      windowSeconds: 60,
      keyGenerator: () => `customer:firebase-token:${auth.session.id}`,
    });
    if (rateLimitResponse) return rateLimitResponse;

    if (!firebaseAdminAuth) {
      return NextResponse.json(
        { error: "Firebase Admin belum terkonfigurasi" },
        { status: 503 },
      );
    }

    const customToken = await firebaseAdminAuth.createCustomToken(
      auth.session.id,
      buildCustomerRealtimeClaims(),
    );
    return NextResponse.json({ token: customToken });
  } catch (error) {
    logger.error("Customer Firebase custom token error:", error);
    return NextResponse.json(
      { error: "Gagal membuat Firebase custom token" },
      { status: 500 },
    );
  }
}
