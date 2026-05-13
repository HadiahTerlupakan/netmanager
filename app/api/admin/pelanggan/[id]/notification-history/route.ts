import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { prisma } from "@/modules/database";

type NotificationChannel = "inApp" | "push" | "whatsapp" | "email";

type UnifiedEntry = {
  id: string;
  channel: NotificationChannel;
  status: string;
  title: string | null;
  message: string | null;
  error: string | null;
  createdAt: string;
};

const HISTORY_LIMIT = 50;

/** Ambil riwayat notifikasi dari semua channel untuk satu pelanggan */
export const GET = createHandler(
  { auth: true },
  async (_req: NextRequest, ctx) => {
    const pelangganId = ctx.params.id as string;

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        id: true,
        nama: true,
        userId: true,
        email: true,
        noTelp: true,
      },
    });

    if (!pelanggan) {
      return ApiErrors.notFound("Pelanggan tidak ditemukan");
    }

    const [inAppNotifs, emailLogs, deadLetters, whatsappMessages] =
      await Promise.all([
        pelanggan.userId
          ? prisma.notifications.findMany({
              where: { userId: pelanggan.userId },
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
              where: { to: pelanggan.email },
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
          where: { pelangganId },
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
              where: { phone: pelanggan.noTelp },
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

    const entries: UnifiedEntry[] = [
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
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return apiSuccess({
      pelanggan: { id: pelanggan.id, nama: pelanggan.nama },
      entries: entries.slice(0, HISTORY_LIMIT),
    });
  },
);
