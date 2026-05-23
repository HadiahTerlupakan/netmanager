import { prisma } from "@/modules/database";
import {
  toEmailDeliveryLogDTO,
  type EmailDeliveryLogDTO,
} from "../dto/EmailDeliveryLogDTO";

const SEARCH_MAX_LENGTH = 255;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const VALID_EMAIL_STATUSES = new Set(["PENDING", "SENT", "FAILED", "BOUNCED"]);

export interface EmailLogListParams {
  isSuperAdmin: boolean;
  tenantId: string | null;
  /** Filter status (PENDING/SENT/FAILED/BOUNCED). Value invalid diabaikan. */
  status?: string | null;
  /** Search berdasarkan email penerima (substring, max 255 char). */
  search?: string | null;
  page: number;
  limit: number;
}

export interface EmailLogListResult {
  items: EmailDeliveryLogDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class EmailLogSearchTooLongError extends Error {
  constructor() {
    super("Search query terlalu panjang");
    this.name = "EmailLogSearchTooLongError";
  }
}

export function normalizeEmailLogPage(raw: string | null): number {
  return Math.max(1, parseInt(raw ?? "1", 10));
}

export function normalizeEmailLogLimit(raw: string | null): number {
  return Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10)),
  );
}

/**
 * Ambil daftar log pengiriman email dengan filter & pagination.
 * Tenant filter di-spread agar non-super admin tidak akses tenant lain.
 * Super admin lihat lintas-tenant → alamat email penerima dimask.
 */
export async function listEmailDeliveryLogs(
  params: EmailLogListParams,
): Promise<EmailLogListResult> {
  const { isSuperAdmin, tenantId, page, limit } = params;

  if (params.search && params.search.length > SEARCH_MAX_LENGTH) {
    throw new EmailLogSearchTooLongError();
  }

  const status =
    params.status && VALID_EMAIL_STATUSES.has(params.status)
      ? params.status
      : null;

  const where: Record<string, unknown> = {
    ...(!isSuperAdmin ? { tenantId } : {}),
  };
  if (status) where.status = status;
  if (params.search) {
    where.to = { contains: params.search, mode: "insensitive" };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.emailDeliveryLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.emailDeliveryLog.count({ where }),
  ]);

  return {
    items: items.map((item) =>
      toEmailDeliveryLogDTO(item, { maskRecipient: isSuperAdmin }),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
