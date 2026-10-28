import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 10;

/**
 * Notifikasi in-app untuk pelanggan portal, disimpan per pelanggan.
 *
 * Tidak lewat `createNotification`: jalur itu menyiarkan notifikasi
 * berprioritas tinggi ke websocket dan push admin, sehingga kabar tagihan
 * pelanggan ikut sampai ke staf.
 */
export function createCustomerNotification(input: {
  pelangganId: string;
  userId?: string | null;
  tenantId?: string | null;
  title: string;
  message: string;
  link?: string;
  sourceType?: string;
  sourceId?: string;
}) {
  return prisma.notifications.create({
    data: {
      id: crypto.randomUUID(),
      type: "SYSTEM",
      priority: "HIGH",
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      pelangganId: input.pelangganId,
      userId: input.userId ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      tenantId: input.tenantId ?? null,
    },
  });
}

/**
 * Notifikasi tersimpan milik pelanggan. Baris lama hanya punya userId (akun
 * User yang tertaut), jadi keduanya dicari.
 */
export function getCustomerStoredNotifications(input: {
  pelangganId: string;
  userId?: string | null;
  limit?: number;
}) {
  return prisma.notifications.findMany({
    where: {
      OR: [
        { pelangganId: input.pelangganId },
        ...(input.userId ? [{ userId: input.userId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? DEFAULT_LIMIT,
  });
}
