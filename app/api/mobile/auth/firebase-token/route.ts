import { NextRequest, NextResponse } from "next/server";

import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { auth as firebaseAdminAuth } from "@/lib/firebase/admin";
import { isSuperAdminRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { advancedRateLimit } from "@/lib/middleware/advanced-rate-limit";

export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) return authResult;

    // Rate limit: 10 mints per menit per user. Tanpa ini, single user
    // dengan looping bug bisa habiskan Firebase project quota
    // (createCustomToken ~0.5 QPS sustained) dan DoS realtime untuk
    // semua tenant.
    const rateLimitResponse = await advancedRateLimit(req, {
      maxRequests: 10,
      windowSeconds: 60,
      keyGenerator: () => `mobile:firebase-token:${authResult.id}`,
    });
    if (rateLimitResponse) return rateLimitResponse;

    if (!firebaseAdminAuth) {
      return NextResponse.json(
        { error: "Firebase Admin belum terkonfigurasi" },
        { status: 503 },
      );
    }

    const session = authResult;
    const isSuperAdmin =
      Boolean(session.isSuperAdmin) || isSuperAdminRole(session.role || "USER");
    const primarySiteId =
      (session.primarySiteId as string | undefined) ??
      session.siteId ??
      undefined;

    const claims = {
      role: isSuperAdmin ? "SUPER_ADMIN" : (session.role ?? "USER"),
      tenantId: session.tenantId ?? null,
      departmentId: session.departmentId ?? null,
      siteId: session.siteId ?? primarySiteId ?? null,
      primarySiteId: primarySiteId ?? null,
      accessAdminPanel: Boolean(session.accessAdminPanel),
      accessEmployeePanel: true,
      isSuperAdmin,
    };

    // Persist ke Firebase Auth user record agar Firestore rules melihat
    // claim yang fresh tanpa harus tunggu user logout-login. Tanpa ini,
    // role demosi (mis. ADMIN → OPERATOR) tidak efektif sampai user
    // sign-in ulang ke mobile — ada window privilege escalation berhari.
    //
    // Catatan: ID token client tetap memuat claim lama sampai mereka
    // panggil getIdToken(true). Mobile (RealtimeService) sudah handle
    // ini lewat error branching `permission-denied` → re-mint.
    try {
      await firebaseAdminAuth.setCustomUserClaims(session.id, claims);
    } catch (claimsError) {
      logger.warn(
        "[firebase-token] setCustomUserClaims failed (non-fatal, custom token tetap diissue):",
        claimsError,
      );
    }

    const customToken = await firebaseAdminAuth.createCustomToken(
      session.id,
      claims,
    );

    return NextResponse.json({ token: customToken });
  } catch (error) {
    logger.error("Mobile Firebase custom token error:", error);
    return NextResponse.json(
      { error: "Gagal membuat Firebase custom token" },
      { status: 500 },
    );
  }
}
