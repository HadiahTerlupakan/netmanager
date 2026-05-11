import { NextRequest, NextResponse } from "next/server";

import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { auth as firebaseAdminAuth } from "@/lib/firebase/admin";
import { isSuperAdminRole } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) return authResult;

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

    const customToken = await firebaseAdminAuth.createCustomToken(session.id, {
      role: isSuperAdmin ? "SUPER_ADMIN" : (session.role ?? "USER"),
      tenantId: session.tenantId ?? null,
      departmentId: session.departmentId ?? null,
      siteId: session.siteId ?? primarySiteId ?? null,
      primarySiteId: primarySiteId ?? null,
      accessAdminPanel: Boolean(session.accessAdminPanel),
      accessEmployeePanel: true,
      isSuperAdmin,
    });

    return NextResponse.json({ token: customToken });
  } catch (error) {
    logger.error("Mobile Firebase custom token error:", error);
    return NextResponse.json(
      { error: "Gagal membuat Firebase custom token" },
      { status: 500 },
    );
  }
}
