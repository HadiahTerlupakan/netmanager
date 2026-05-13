import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";
import {
  NotificationDispatcher,
  BILLING_TEMPLATES,
} from "@/modules/notification";
import type {
  NotificationChannel,
  BillingTemplateKey,
} from "@/modules/notification";

/** Channel yang valid untuk notifikasi. */
const VALID_CHANNELS = new Set(["inApp", "push", "whatsapp", "email"]);

/**
 * POST /api/admin/notifications/dead-letter/[id]/retry
 * Resend notifikasi yang gagal via channel yang sama, lalu mark resolved.
 */
export const POST = createHandler(
  { auth: true, permissions: ["notifications:manage"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;

    const entry = await prisma.notificationDeadLetter.findUnique({
      where: { id },
    });

    if (!entry) {
      return ApiErrors.notFound("Entry dead letter");
    }

    // Tenant ownership check — cegah IDOR
    if (!isSuperAdmin && entry.tenantId !== ctx.session!.user.tenantId) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    if (entry.resolvedAt) {
      return ApiErrors.badRequest("Entry ini sudah resolved");
    }

    // Validasi templateKey melawan BILLING_TEMPLATES
    if (!(entry.templateKey in BILLING_TEMPLATES)) {
      return ApiErrors.badRequest("Template key tidak valid");
    }

    // Validasi channel
    if (!VALID_CHANNELS.has(entry.channel)) {
      return ApiErrors.badRequest("Channel tidak valid");
    }

    const dispatcher = new NotificationDispatcher();
    await dispatcher.dispatch({
      pelangganId: entry.pelangganId,
      templateKey: entry.templateKey as BillingTemplateKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: entry.params as any,
      sourceType: "RETRY_DLQ",
      sourceId: entry.id,
      channels: [entry.channel as NotificationChannel],
    });

    await prisma.notificationDeadLetter.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });

    return apiSuccess({ retried: true });
  },
);
