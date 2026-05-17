import type { NotificationDeadLetter } from "@prisma/client";
import { prisma } from "@/modules/database";
import {
  NotificationDispatcher,
  type NotificationChannel,
} from "./NotificationDispatcher";
import {
  BILLING_TEMPLATES,
  type BillingTemplateKey,
} from "../templates/billing-templates";

const VALID_CHANNELS = new Set<NotificationChannel>([
  "inApp",
  "push",
  "whatsapp",
  "email",
]);

const PELANGGAN_ID_MAX_LENGTH = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface DeadLetterListParams {
  isSuperAdmin: boolean;
  tenantId: string | null;
  /** Filter channel notifikasi (inApp/push/whatsapp/email). */
  channel?: string | null;
  /** Filter pelanggan id (max 100 char, dibuang bila lebih). */
  pelangganId?: string | null;
  /** True bila ingin lihat yang sudah resolved; false (default) untuk yang masih failed. */
  resolved: boolean;
  page: number;
  limit: number;
}

export interface DeadLetterListResult {
  items: NotificationDeadLetter[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class DeadLetterNotFoundError extends Error {
  constructor() {
    super("Entry dead letter");
    this.name = "DeadLetterNotFoundError";
  }
}

export class DeadLetterAccessDeniedError extends Error {
  constructor() {
    super("Akses ditolak");
    this.name = "DeadLetterAccessDeniedError";
  }
}

export class DeadLetterAlreadyResolvedError extends Error {
  constructor() {
    super("Entry ini sudah resolved");
    this.name = "DeadLetterAlreadyResolvedError";
  }
}

export class DeadLetterInvalidTemplateError extends Error {
  constructor() {
    super("Template key tidak valid");
    this.name = "DeadLetterInvalidTemplateError";
  }
}

export class DeadLetterInvalidChannelError extends Error {
  constructor() {
    super("Channel tidak valid");
    this.name = "DeadLetterInvalidChannelError";
  }
}

/** Normalisasi page (>= 1). */
export function normalizeDeadLetterPage(raw: string | null): number {
  return Math.max(1, parseInt(raw ?? "1", 10));
}

/** Normalisasi limit (1..MAX_PAGE_SIZE, default DEFAULT_PAGE_SIZE). */
export function normalizeDeadLetterLimit(raw: string | null): number {
  return Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10)),
  );
}

/**
 * Ambil daftar dead letter notifikasi dengan filter & pagination.
 * Tenant filter di-spread agar non-super admin tidak akses tenant lain.
 */
export async function listNotificationDeadLetters(
  params: DeadLetterListParams,
): Promise<DeadLetterListResult> {
  const { isSuperAdmin, tenantId, resolved, page, limit } = params;

  // Validasi channel — value invalid diabaikan (lenient)
  const channel =
    params.channel && VALID_CHANNELS.has(params.channel as NotificationChannel)
      ? (params.channel as NotificationChannel)
      : null;

  // Validasi pelangganId — max 100 karakter; jika lebih diabaikan
  const pelangganId =
    params.pelangganId && params.pelangganId.length <= PELANGGAN_ID_MAX_LENGTH
      ? params.pelangganId
      : null;

  const where: Record<string, unknown> = {
    resolvedAt: resolved ? { not: null } : null,
    ...(!isSuperAdmin ? { tenantId } : {}),
  };
  if (channel) where.channel = channel;
  if (pelangganId) where.pelangganId = pelangganId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.notificationDeadLetter.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.notificationDeadLetter.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

interface MutateDeadLetterParams {
  id: string;
  isSuperAdmin: boolean;
  tenantId: string | null;
}

/**
 * Tandai DLQ entry sebagai resolved tanpa retry.
 * Throw DeadLetterNotFoundError / AccessDenied / AlreadyResolved bila gagal.
 */
export async function resolveDeadLetter(
  params: MutateDeadLetterParams,
): Promise<{ resolved: true }> {
  const entry = await prisma.notificationDeadLetter.findUnique({
    where: { id: params.id },
  });

  if (!entry) throw new DeadLetterNotFoundError();
  if (!params.isSuperAdmin && entry.tenantId !== params.tenantId) {
    throw new DeadLetterAccessDeniedError();
  }
  if (entry.resolvedAt) throw new DeadLetterAlreadyResolvedError();

  await prisma.notificationDeadLetter.update({
    where: { id: params.id },
    data: { resolvedAt: new Date() },
  });

  return { resolved: true };
}

/**
 * Resend notifikasi DLQ via channel yang sama, lalu mark resolved.
 * Throw DeadLetterNotFoundError / AccessDenied / AlreadyResolved /
 * InvalidTemplate / InvalidChannel bila gagal.
 */
export async function retryDeadLetter(
  params: MutateDeadLetterParams,
): Promise<{ retried: true }> {
  const entry = await prisma.notificationDeadLetter.findUnique({
    where: { id: params.id },
  });

  if (!entry) throw new DeadLetterNotFoundError();
  if (!params.isSuperAdmin && entry.tenantId !== params.tenantId) {
    throw new DeadLetterAccessDeniedError();
  }
  if (entry.resolvedAt) throw new DeadLetterAlreadyResolvedError();
  if (!(entry.templateKey in BILLING_TEMPLATES)) {
    throw new DeadLetterInvalidTemplateError();
  }
  if (!VALID_CHANNELS.has(entry.channel as NotificationChannel)) {
    throw new DeadLetterInvalidChannelError();
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
    dedupeKey: `retry-dlq:${entry.id}`,
  });

  await prisma.notificationDeadLetter.update({
    where: { id: params.id },
    data: { resolvedAt: new Date() },
  });

  return { retried: true };
}
