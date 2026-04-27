import { prisma, prismaMitra } from "@/modules/database";

const PUSH_TOKEN_ADDED_MESSAGE = "Push token terdaftar";
const PUSH_TOKEN_REMOVED_MESSAGE = "Push token dihapus";

type MobilePushSession = {
  id: string;
  tenantId?: string | null;
  role?: string;
};

/** Mendaftarkan push token mobile lama sambil menjaga token tetap unik. */
export async function registerMobilePushToken(
  session: MobilePushSession,
  pushToken: string,
) {
  await clearExistingPushTokenOwners(
    session.id,
    session.tenantId ?? null,
    pushToken,
  );
  await updateOwnerPushToken(session, pushToken);
  return { message: PUSH_TOKEN_ADDED_MESSAGE };
}

/** Menghapus push token mobile lama saat logout. */
export async function removeMobilePushToken(session: MobilePushSession) {
  await updateOwnerPushToken(session, null);
  return { message: PUSH_TOKEN_REMOVED_MESSAGE };
}

async function clearExistingPushTokenOwners(
  userId: string,
  tenantId: string | null,
  pushToken: string,
) {
  await Promise.all([
    prisma.user.updateMany({
      where: {
        pushToken,
        id: { not: userId },
        tenantId: tenantId ?? undefined,
      },
      data: { pushToken: null, pushTokenUpdatedAt: null },
    }),
    prisma.pelanggan.updateMany({
      where: {
        pushToken,
        id: { not: userId },
        tenantId: tenantId ?? undefined,
      },
      data: { pushToken: null, pushTokenUpdatedAt: null },
    }),
    prismaMitra.mitra.updateMany({
      where: { pushToken, id: { not: userId } },
      data: { pushToken: null, pushTokenUpdatedAt: null },
    }),
  ]);
}

async function updateOwnerPushToken(
  session: MobilePushSession,
  pushToken: string | null,
) {
  if (session.role === "CUSTOMER") {
    await prisma.pelanggan.update({
      where: { id: session.id, tenantId: session.tenantId ?? undefined },
      data: buildPushTokenPayload(pushToken),
    });
    return;
  }

  if (session.role === "MITRA") {
    await prismaMitra.mitra.update({
      where: { id: session.id },
      data: buildPushTokenPayload(pushToken),
    });
    return;
  }

  await prisma.user.update({
    where: { id: session.id, tenantId: session.tenantId ?? undefined },
    data: buildPushTokenPayload(pushToken),
  });
}

function buildPushTokenPayload(pushToken: string | null) {
  return {
    pushToken,
    pushTokenUpdatedAt: pushToken ? new Date() : null,
  };
}
