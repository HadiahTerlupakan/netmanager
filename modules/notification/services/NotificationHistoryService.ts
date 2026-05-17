import { prisma } from "@/modules/database";

export type NotificationChannel = "inApp" | "push" | "whatsapp" | "email";

export interface NotificationHistoryEntry {
  id: string;
  channel: NotificationChannel;
  status: string;
  title: string | null;
  message: string | null;
  error: string | null;
  createdAt: string;
}

export interface NotificationHistoryResult {
  pelanggan: { id: string; nama: string };
  entries: NotificationHistoryEntry[];
}

export class PelangganNotFoundError extends Error {
  constructor() {
    super("Pelanggan tidak ditemukan");
    this.name = "PelangganNotFoundError";
  }
}

const HISTORY_LIMIT = 50;

interface GetNotificationHistoryParams {
  pelangganId: string;
  /** Bila true, abaikan filter tenant (super admin saja). */
  isSuperAdmin: boolean;
  /** Tenant aktif untuk filter (wajib bila bukan super admin). */
  tenantId: string | null;
}

/**
 * Ambil riwayat notifikasi lintas-channel (in-app, email, WhatsApp, dead letter)
 * untuk satu pelanggan dalam scope tenant aktif.
 *
 * Defense in depth: tenant filter di-spread ke setiap query agar tidak
 * tergantung satu titik enforcement.
 */
export async function getPelangganNotificationHistory(
  params: GetNotificationHistoryParams,
): Promise<NotificationHistoryResult> {
  const { pelangganId, isSuperAdmin, tenantId } = params;
  const tenantFilter = !isSuperAdmin ? { tenantId: tenantId! } : {};

  // findFirst supaya bisa kombinasikan id + tenantId — non-super admin
  // tidak boleh mengakses pelanggan tenant lain.
  const pelanggan = await prisma.pelanggan.findFirst({
    where: { id: pelangganId, ...tenantFilter },
    select: {
      id: true,
      nama: true,
      userId: true,
      email: true,
      noTelp: true,
    },
  });

  if (!pelanggan) {
    throw new PelangganNotFoundError();
  }

  const [inAppNotifs, emailLogs, deadLetters, whatsappMessages] =
    await Promise.all([
      pelanggan.userId
        ? prisma.notifications.findMany({
            where: { userId: pelanggan.userId, ...tenantFilter },
            orderBy: { createdAt: "desc" },
            take: HISTORY_LIMIT,
            select: {
              id: true,
              title: true,
              message: true,
              isRead: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),

      pelanggan.email
        ? prisma.emailDeliveryLog.findMany({
            where: { to: pelanggan.email, ...tenantFilter },
            orderBy: { createdAt: "desc" },
            take: HISTORY_LIMIT,
            select: {
              id: true,
              subject: true,
              to: true,
              status: true,
              error: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),

      prisma.notificationDeadLetter.findMany({
        where: { pelangganId, ...tenantFilter },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
        select: {
          id: true,
          channel: true,
          templateKey: true,
          error: true,
          resolvedAt: true,
          createdAt: true,
        },
      }),

      pelanggan.noTelp
        ? prisma.whatsAppMessage.findMany({
            where: { phone: pelanggan.noTelp, ...tenantFilter },
            orderBy: { createdAt: "desc" },
            take: HISTORY_LIMIT,
            select: {
              id: true,
              message: true,
              status: true,
              error: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const entries: NotificationHistoryEntry[] = [
    ...inAppNotifs.map((n) => ({
      id: `inapp-${n.id}`,
      channel: "inApp" as const,
      status: n.isRead ? "READ" : "UNREAD",
      title: n.title,
      message: n.message,
      error: null as string | null,
      createdAt: n.createdAt.toISOString(),
    })),

    ...emailLogs.map((e) => ({
      id: `email-${e.id}`,
      channel: "email" as const,
      status: e.status,
      title: e.subject,
      message: `To: ${e.to}`,
      error: e.error ?? null,
      createdAt: e.createdAt.toISOString(),
    })),

    ...deadLetters.map((d) => ({
      id: `dlq-${d.id}`,
      channel: d.channel as NotificationChannel,
      status: d.resolvedAt ? "RESOLVED" : "FAILED",
      title: `[DLQ] ${d.templateKey}`,
      message: null as string | null,
      error: d.error,
      createdAt: d.createdAt.toISOString(),
    })),

    ...whatsappMessages.map((w) => ({
      id: `wa-${w.id}`,
      channel: "whatsapp" as const,
      status: w.status.toUpperCase(),
      title: "WhatsApp",
      message: w.message ?? null,
      error: w.error ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    pelanggan: { id: pelanggan.id, nama: pelanggan.nama },
    entries: entries.slice(0, HISTORY_LIMIT),
  };
}
