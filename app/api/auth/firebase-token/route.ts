import { logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { auth as firebaseAdminAuth } from "@/lib/firebase/admin";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user?.id) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    if (!firebaseAdminAuth) {
      return NextResponse.json(
        { error: "Firebase Admin belum terkonfigurasi" },
        { status: 503 },
      );
    }

    const isSuperAdmin =
      user.isSuperAdmin === true ||
      user.role === "SUPER_ADMIN" ||
      user.role === "Super Admin";
    const legacySiteId = (user as { siteId?: string | null }).siteId ?? null;
    const primarySiteId = user.primarySiteId ?? legacySiteId;
    const customToken = await firebaseAdminAuth.createCustomToken(user.id, {
      role: isSuperAdmin ? "SUPER_ADMIN" : (user.role ?? "USER"),
      tenantId: user.tenantId ?? null,
      departmentId: user.departmentId ?? null,
      siteId: primarySiteId,
      primarySiteId,
      accessAdminPanel: user.accessAdminPanel ?? false,
      accessEmployeePanel: user.accessEmployeePanel ?? false,
      isSuperAdmin,
    });

    return NextResponse.json({ token: customToken });
  } catch (error) {
    logger.error("Firebase custom token error:", error);
    return NextResponse.json(
      { error: "Gagal membuat Firebase custom token" },
      { status: 500 },
    );
  }
}
