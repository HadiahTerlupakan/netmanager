import type { NotificationDeadLetter, Prisma } from "@prisma/client";
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

export interface DeadLetterFilter {
  resolved: boolean;
  channel?: string | null;
  pelangganId?: string | null;
  tenantId?: string | null;
  isSuperAdmin: boolean;
}

export interface DeadLetterPagination {
  skip: number;
  take: number;
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

  /** Ambil DLQ entry by id (tanpa filter tenant — caller wajib enforce). */
  async findById(id: string): Promise<NotificationDeadLetter | null> {
    return prisma.notificationDeadLetter.findUnique({ where: { id } });
  }

  /**
   * Mark DLQ entry resolved hanya bila masih pending (resolvedAt = null).
   * Atomic — mencegah race condition saat dua admin retry/resolve bersamaan.
   * Return true bila berhasil claim, false bila sudah resolved.
   */
  async markResolvedIfPending(id: string): Promise<boolean> {
    const result = await prisma.notificationDeadLetter.updateMany({
      where: { id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    return result.count > 0;
  }

  /** Tandai DLQ entry sebagai resolved (sudah di-handle manual oleh admin). */
  async resolve(id: string): Promise<void> {
    await prisma.notificationDeadLetter.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
  }

  /** Ambil semua DLQ entry yang belum resolved, opsional filter per channel + tenant. */
  async findUnresolved(options?: {
    channel?: string;
    tenantId?: string | null;
    limit?: number;
  }): Promise<
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
        ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
    });
  }

  /** Listing DLQ dengan filter & pagination untuk admin route. */
  async findManyWithFilter(
    filter: DeadLetterFilter,
    pagination: DeadLetterPagination,
  ): Promise<{ items: NotificationDeadLetter[]; total: number }> {
    const where = this.buildWhere(filter);
    const [items, total] = await Promise.all([
      prisma.notificationDeadLetter.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.notificationDeadLetter.count({ where }),
    ]);
    return { items, total };
  }

  private buildWhere(
    filter: DeadLetterFilter,
  ): Prisma.NotificationDeadLetterWhereInput {
    const where: Prisma.NotificationDeadLetterWhereInput = {
      resolvedAt: filter.resolved ? { not: null } : null,
    };
    if (!filter.isSuperAdmin) where.tenantId = filter.tenantId;
    if (filter.channel) where.channel = filter.channel;
    if (filter.pelangganId) where.pelangganId = filter.pelangganId;
    return where;
  }
}
