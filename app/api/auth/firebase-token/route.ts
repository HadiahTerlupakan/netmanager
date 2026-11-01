import { logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { auth as firebaseAdminAuth } from "@/lib/firebase/admin";
import { buildRealtimeClaims } from "@/lib/realtime/firebase-claims";

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

    const customToken = await firebaseAdminAuth.createCustomToken(
      user.id,
      buildRealtimeClaims(user),
    );

    return NextResponse.json({ token: customToken });
  } catch (error) {
    logger.error("Firebase custom token error:", error);
    return NextResponse.json(
      { error: "Gagal membuat Firebase custom token" },
      { status: 500 },
    );
  }
}
