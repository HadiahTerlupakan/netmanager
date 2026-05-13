import { prisma } from "@/modules/database";

export interface DeadLetterInput {
  channel: "inApp" | "push" | "whatsapp" | "email";
  pelangganId: string;
  templateKey: string;
  params: Record<string, unknown>;
  error: string;
  attemptCount?: number;
  tenantId?: string | null;
}

/** Repository untuk notifikasi yang ultimate gagal setelah retry. Admin bisa resend manual. */
export class NotificationDeadLetterRepository {
  /** Catat notifikasi gagal ke DLQ. Return id record yang dibuat. */
  async record(input: DeadLetterInput): Promise<string> {
    const dlq = await prisma.notificationDeadLetter.create({
      data: {
        channel: input.channel,
        pelangganId: input.pelangganId,
        templateKey: input.templateKey,
        params: input.params as object,
        error: input.error,
        attemptCount: input.attemptCount ?? 1,
        lastAttemptAt: new Date(),
        tenantId: input.tenantId ?? null,
      },
    });
    return dlq.id;
  }

  /** Tandai DLQ entry sebagai resolved (sudah di-handle manual oleh admin). */
  async resolve(id: string): Promise<void> {
    await prisma.notificationDeadLetter.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
  }

  /** Ambil semua DLQ entry yang belum resolved, opsional filter per channel. */
  async findUnresolved(options?: { channel?: string; limit?: number }): Promise<
    {
      id: string;
      channel: string;
      pelangganId: string;
      templateKey: string;
      params: unknown;
      error: string;
      attemptCount: number;
      lastAttemptAt: Date | null;
      tenantId: string | null;
      createdAt: Date;
    }[]
  > {
    return prisma.notificationDeadLetter.findMany({
      where: {
        resolvedAt: null,
        ...(options?.channel ? { channel: options.channel } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
    });
  }
}
