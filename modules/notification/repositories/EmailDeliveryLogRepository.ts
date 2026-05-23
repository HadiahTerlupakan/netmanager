import { prisma } from "@/modules/database";
import type { EmailErrorCategory } from "../services/email-error-classifier";

export interface EmailLogCreateInput {
  to: string;
  subject: string;
  tenantId: string | null;
}

/** Repository untuk log pengiriman email (PENDING → SENT/FAILED tracking). */
export class EmailDeliveryLogRepository {
  /** Buat log baru dengan status PENDING, return id untuk update selanjutnya. */
  async logAttempt(input: EmailLogCreateInput): Promise<string> {
    const log = await prisma.emailDeliveryLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        status: "PENDING",
        tenantId: input.tenantId,
      },
    });
    return log.id;
  }

  /** Tandai pengiriman berhasil, simpan messageId dari provider. */
  async markSent(id: string, messageId?: string): Promise<void> {
    await prisma.emailDeliveryLog.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        messageId: messageId ?? null,
      },
    });
  }

  /**
   * Tandai pengiriman gagal. Pesan error disanitasi pemanggil; kategori
   * di-prefix ke string `error` agar tidak butuh migration kolom baru.
   * Format: `[CATEGORY] safe message`.
   */
  async markFailed(
    id: string,
    safeMessage: string,
    category: EmailErrorCategory,
  ): Promise<void> {
    await prisma.emailDeliveryLog.update({
      where: { id },
      data: { status: "FAILED", error: `[${category}] ${safeMessage}` },
    });
  }

  /**
   * Cek apakah ada email dengan to+subject yang sudah SENT/PENDING dalam window
   * waktu tertentu. Dipakai sebagai dedup guard untuk cegah double-send akibat
   * scheduler/event handler yang ter-trigger berulang.
   */
  async hasRecentDelivery(input: {
    to: string;
    subject: string;
    tenantId: string | null;
    sinceMs: number;
  }): Promise<boolean> {
    const since = new Date(Date.now() - input.sinceMs);
    const count = await prisma.emailDeliveryLog.count({
      where: {
        to: input.to,
        subject: input.subject,
        tenantId: input.tenantId,
        status: { in: ["SENT", "PENDING"] },
        createdAt: { gte: since },
      },
    });
    return count > 0;
  }
}
