import { prisma } from "@/modules/database";

export interface EmailLogCreateInput {
  to: string;
  subject: string;
  tenantId?: string | null;
}

/** Repository untuk log pengiriman email (PENDING → SENT/FAILED/BOUNCED tracking). */
export class EmailDeliveryLogRepository {
  /** Buat log baru dengan status PENDING, return id untuk update selanjutnya. */
  async logAttempt(input: EmailLogCreateInput): Promise<string> {
    const log = await prisma.emailDeliveryLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        status: "PENDING",
        tenantId: input.tenantId ?? null,
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

  /** Tandai pengiriman gagal, simpan pesan error. */
  async markFailed(id: string, error: string): Promise<void> {
    await prisma.emailDeliveryLog.update({
      where: { id },
      data: { status: "FAILED", error },
    });
  }

  /** Tandai email bounced (dipanggil dari webhook provider). */
  async markBounced(id: string): Promise<void> {
    await prisma.emailDeliveryLog.update({
      where: { id },
      data: { status: "BOUNCED", bouncedAt: new Date() },
    });
  }
}
