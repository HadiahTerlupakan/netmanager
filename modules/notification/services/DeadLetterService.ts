import type { NotificationDeadLetter } from "@prisma/client";
import {
  NotificationDispatcher,
  type NotificationChannel,
} from "./NotificationDispatcher";
import {
  BILLING_TEMPLATES,
  type BillingTemplateKey,
} from "../templates/billing-templates";
import { NotificationDeadLetterRepository } from "../repositories/NotificationDeadLetterRepository";

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
    super("Entry dead letter tidak ditemukan");
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

interface MutateDeadLetterParams {
  id: string;
  isSuperAdmin: boolean;
  tenantId: string | null;
}

/**
 * DeadLetterService — orchestrator query/mutasi DLQ notifikasi.
 *
 * Why: route admin (resolve/retry/list) butuh akses DLQ tanpa langsung pakai
 * Prisma. Service ini wrap repository + integrasi ke `NotificationDispatcher`
 * untuk operasi retry.
 */
export class DeadLetterService {
  constructor(
    private readonly dlqRepository: NotificationDeadLetterRepository = new NotificationDeadLetterRepository(),
    private readonly dispatcherFactory: () => NotificationDispatcher = () =>
      new NotificationDispatcher(),
  ) {}

  /** Listing dengan tenant filter — non-super admin di-restrict ke tenant-nya. */
  async list(params: DeadLetterListParams): Promise<DeadLetterListResult> {
    const channel = this.normalizeChannel(params.channel);
    const pelangganId = this.normalizePelangganId(params.pelangganId);
    const skip = (params.page - 1) * params.limit;

    const { items, total } = await this.dlqRepository.findManyWithFilter(
      {
        isSuperAdmin: params.isSuperAdmin,
        tenantId: params.tenantId,
        resolved: params.resolved,
        channel,
        pelangganId,
      },
      { skip, take: params.limit },
    );

    return {
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  /** Tandai resolved tanpa retry (pakai atomic conditional update). */
  async resolve(params: MutateDeadLetterParams): Promise<{ resolved: true }> {
    const entry = await this.findAndAuthorize(params);
    if (entry.resolvedAt) throw new DeadLetterAlreadyResolvedError();

    const claimed = await this.dlqRepository.markResolvedIfPending(params.id);
    if (!claimed) throw new DeadLetterAlreadyResolvedError();

    return { resolved: true };
  }

  /**
   * Resend notifikasi DLQ via channel yang sama, lalu mark resolved.
   * Atomic claim dilakukan SEBELUM dispatch agar dua request retry bersamaan
   * tidak menyebabkan double-send.
   */
  async retry(params: MutateDeadLetterParams): Promise<{ retried: true }> {
    const entry = await this.findAndAuthorize(params);
    if (entry.resolvedAt) throw new DeadLetterAlreadyResolvedError();
    if (!(entry.templateKey in BILLING_TEMPLATES)) {
      throw new DeadLetterInvalidTemplateError();
    }
    if (!VALID_CHANNELS.has(entry.channel as NotificationChannel)) {
      throw new DeadLetterInvalidChannelError();
    }

    const claimed = await this.dlqRepository.markResolvedIfPending(params.id);
    if (!claimed) throw new DeadLetterAlreadyResolvedError();

    const dispatcher = this.dispatcherFactory();
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

    return { retried: true };
  }

  private async findAndAuthorize(
    params: MutateDeadLetterParams,
  ): Promise<NotificationDeadLetter> {
    const entry = await this.dlqRepository.findById(params.id);
    if (!entry) throw new DeadLetterNotFoundError();
    if (!params.isSuperAdmin && entry.tenantId !== params.tenantId) {
      throw new DeadLetterAccessDeniedError();
    }
    return entry;
  }

  private normalizeChannel(raw: string | null | undefined): string | null {
    if (!raw) return null;
    return VALID_CHANNELS.has(raw as NotificationChannel) ? raw : null;
  }

  private normalizePelangganId(raw: string | null | undefined): string | null {
    if (!raw) return null;
    return raw.length <= PELANGGAN_ID_MAX_LENGTH ? raw : null;
  }
}

const defaultService = new DeadLetterService();

/** Backward-compatible function wrapper — caller existing tetap bisa import as function. */
export function listNotificationDeadLetters(
  params: DeadLetterListParams,
): Promise<DeadLetterListResult> {
  return defaultService.list(params);
}

export function resolveDeadLetter(
  params: MutateDeadLetterParams,
): Promise<{ resolved: true }> {
  return defaultService.resolve(params);
}

export function retryDeadLetter(
  params: MutateDeadLetterParams,
): Promise<{ retried: true }> {
  return defaultService.retry(params);
}
