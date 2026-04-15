import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { prisma, prismaMitra } from "@/modules/database";

function getSessionUserId(session: { userId?: string; id?: string }) {
  return session.userId ?? session.id ?? null;
}

function buildOwnerWhere(
  session: { role?: string; tenantId?: string | null },
  userId: string,
) {
  if (session.role === "MITRA") {
    return { id: userId, tenantId: session.tenantId ?? undefined };
  }

  return { id: userId, tenantId: session.tenantId ?? undefined };
}

function buildSuccessMessage(action: "add" | "remove") {
  return action === "remove"
    ? "FCM token berhasil dihapus"
    : "FCM token berhasil disimpan";
}

function getUpdatedTokens(tokens: string[], tokenToRemove: string) {
  return tokens.filter((token) => token !== tokenToRemove);
}

async function findOwnerTokens(
  session: { role?: string; tenantId?: string | null },
  userId: string,
) {
  const where = buildOwnerWhere(session, userId);

  if (session.role === "MITRA") {
    return prismaMitra.mitra.findFirst({
      where,
      select: { fcmTokens: true },
    });
  }

  return prisma.user.findFirst({
    where,
    select: { fcmTokens: true },
  });
}

async function appendOwnerToken(
  session: { role?: string },
  userId: string,
  fcmToken: string,
) {
  if (session.role === "MITRA") {
    return prismaMitra.mitra.update({
      where: { id: userId },
      data: {
        fcmTokens: {
          push: fcmToken,
        },
      },
    });
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      fcmTokens: {
        push: fcmToken,
      },
    },
  });
}

async function replaceOwnerTokens(
  session: { role?: string },
  userId: string,
  fcmTokens: string[],
) {
  if (session.role === "MITRA") {
    return prismaMitra.mitra.update({
      where: { id: userId },
      data: {
        fcmTokens: {
          set: fcmTokens,
        },
      },
    });
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      fcmTokens: {
        set: fcmTokens,
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const session = authResult;
    const userId = getSessionUserId(session);
    if (!userId) {
      return ApiErrors.unauthorized("Token tidak valid");
    }

    const { fcmToken, action = "add" } = await req.json();
    if (!fcmToken) {
      return ApiErrors.badRequest("fcmToken wajib diisi");
    }

    const normalizedAction = action === "remove" ? "remove" : "add";
    const owner = await findOwnerTokens(session, userId);

    if (!owner) {
      return ApiErrors.notFound("Pengguna mobile tidak ditemukan");
    }

    if (normalizedAction === "remove") {
      await replaceOwnerTokens(
        session,
        userId,
        getUpdatedTokens(owner.fcmTokens, fcmToken),
      );

      return apiSuccess(null, {
        message: buildSuccessMessage(normalizedAction),
      });
    }

    if (!owner.fcmTokens.includes(fcmToken)) {
      await appendOwnerToken(session, userId, fcmToken);
    }

    return apiSuccess(null, { message: buildSuccessMessage(normalizedAction) });
  } catch (error) {
    console.error("Error FCM token mobile API:", error);
    return ApiErrors.internalError("Terjadi kesalahan pada server");
  }
}
