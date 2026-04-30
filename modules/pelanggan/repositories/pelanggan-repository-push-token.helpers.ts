import { prisma } from "@/lib/prisma";

/** Get customer push token by id. */
export function findByIdWithPushToken(pelangganId: string) {
  return prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: { id: true, pushToken: true },
  });
}

/** Get customers by push token list. */
export function findManyWithPushToken(tokens: string[]) {
  return prisma.pelanggan.findMany({
    where: { pushToken: { in: tokens } },
    select: { id: true, pushToken: true },
  });
}

/** Clear customer push tokens. */
export function clearPushTokens(tokens: string[]) {
  return prisma.pelanggan.updateMany({
    where: { pushToken: { in: tokens } },
    data: { pushToken: null },
  });
}
