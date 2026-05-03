import { logger } from "@/lib/logger";
import { buildPaginationMeta } from "@/lib/utils/pagination";
/**
 * NOTE: Prisma import is intentionally kept here for type safety and enums.
 * This helper uses:
 * - Prisma types for dynamic query building with type safety
 * - Prisma enums (TicketCategory, TicketPriority, TicketStatus) from schema
 * Removing this would require duplicating all Prisma types/enums or losing type safety.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import {
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";
import type { CustomerTicketListItem } from "../domain/ports/ICustomerTicketRepository";
import type {
  ServiceResult,
  TicketFilterOptions,
  UserContext,
} from "./AdminSupportTicketService";
import {
  buildUnreadOpenWhere,
  calculateAverageRating,
  getStatusCounts,
} from "./admin-support-ticket-list.helpers";

/** Get paginated list of tickets with filters and stats. */
export async function getAdminTickets(
  input: AdminTicketListInput,
): Promise<ServiceResult<AdminTicketListResponse>> {
  try {
    const page = input.filters.page ?? 1;
    const limit = input.filters.limit ?? 20;
    const where = buildTicketListWhere(input);
    if (where.success === false) return buildTicketListError(where);

    const ticketListData = await findTicketListData({
      input,
      where: where.data,
      page,
      limit,
    });
    return buildTicketListResult({
      ticketRepo: input.ticketRepo,
      page,
      limit,
      ...ticketListData,
    });
  } catch (error) {
    logger.error("[AdminSupportTicketService.getTickets] Error:", error);
    return {
      success: false,
      error: "Gagal mengambil daftar tiket",
      code: "INTERNAL_ERROR",
    };
  }
}

/** Get single ticket with site access guard. */
export async function getAdminTicketById(input: AdminTicketDetailInput) {
  try {
    const ticket = await input.ticketRepo.findByIdAdmin(input.id);
    if (!ticket) return notFoundResult();
    if (isForbidden(ticket, input.user, input.hasSiteRestriction))
      return forbiddenResult();
    return { success: true, data: ticket };
  } catch (error) {
    logger.error("[AdminSupportTicketService.getTicketById] Error:", error);
    return {
      success: false,
      error: "Gagal mengambil detail tiket",
      code: "INTERNAL_ERROR",
    };
  }
}

/** Hitung tiket yang membutuhkan respon admin. */
export async function getAdminUnreadCount(input: AdminUnreadCountInput) {
  try {
    const openTickets = await input.ticketRepo.countAdmin(
      buildUnreadOpenWhere(input.siteId),
    );
    const needsReply = await countNeedsReply(input, TicketStatus.IN_PROGRESS);
    const waitingReply = await countNeedsReply(
      input,
      TicketStatus.WAITING_CUSTOMER,
    );
    return buildUnreadCountResult(openTickets, needsReply, waitingReply);
  } catch (error) {
    logger.error("[AdminSupportTicketService.getUnreadCount] Error:", error);
    return {
      success: false,
      error: "Gagal mengambil jumlah tiket",
      code: "INTERNAL_ERROR",
    };
  }
}

function buildTicketListWhere(input: AdminTicketListInput): TicketWhereResult {
  const where: Prisma.SupportTicketsWhereInput = {};
  const access = applySiteRestriction(
    where,
    input.user,
    input.hasSiteRestriction,
  );
  if (access.success === false) return access;
  applyTicketFilters(where, input.filters, input.user);
  applyTicketSearch(where, input.filters.search);
  return { success: true, data: where };
}

function applySiteRestriction(
  where: Prisma.SupportTicketsWhereInput,
  user: UserContext,
  hasSiteRestriction: boolean,
): TicketAccessResult {
  if (!hasSiteRestriction || user.role === "SUPER_ADMIN")
    return { success: true as const };
  if (!user.siteId)
    return {
      success: false as const,
      error: "User tidak memiliki akses site",
      code: "FORBIDDEN",
    };
  where.pelanggan = { siteId: user.siteId };
  return { success: true as const };
}

function buildTicketListError(
  error: Extract<TicketWhereResult, { success: false }>,
): ServiceResult<AdminTicketListResponse> {
  return { success: false, error: error.error, code: error.code };
}

function applyTicketFilters(
  where: Prisma.SupportTicketsWhereInput,
  filters: TicketFilterOptions,
  user: UserContext,
) {
  if (filters.status && Object.values(TicketStatus).includes(filters.status))
    where.status = filters.status;
  if (
    filters.category &&
    Object.values(TicketCategory).includes(filters.category)
  )
    where.category = filters.category;
  if (
    filters.priority &&
    Object.values(TicketPriority).includes(filters.priority)
  )
    where.priority = filters.priority;
  if (filters.assignedToMe) where.assignedToId = user.id;
}

function applyTicketSearch(
  where: Prisma.SupportTicketsWhereInput,
  search?: string,
) {
  if (!search) return;
  where.OR = [
    { ticketNumber: { contains: search, mode: "insensitive" } },
    { subject: { contains: search, mode: "insensitive" } },
    { pelanggan: { nama: { contains: search, mode: "insensitive" } } },
    { pelanggan: { idPelanggan: { contains: search, mode: "insensitive" } } },
  ];
}

async function findTicketListData(input: TicketListDataInput) {
  const skip = (input.page - 1) * input.limit;
  const [tickets, total, statusSummary, rating] = await Promise.all([
    input.input.ticketRepo.findAllAdmin(input.where, skip, input.limit),
    input.input.ticketRepo.countAdmin(input.where),
    getStatusCounts(input.input.ticketRepo, input.where),
    calculateAverageRating(input.input.ticketRepo, input.where),
  ]);
  return { tickets, total, statusSummary, rating };
}

function buildTicketListResult(input: TicketListResultInput) {
  return {
    success: true,
    data: {
      tickets: input.ticketRepo.mapCustomerTicketResponses(
        input.tickets as never[],
      ),
      pagination: buildPaginationMeta(input),
      stats: buildTicketListStats(input.statusSummary, input.rating),
    },
  };
}

function buildTicketListStats(
  statusSummary: Record<string, unknown>,
  rating: RatingSummary,
) {
  return {
    ...statusSummary,
    avgRating: rating.avgRating,
    ratedCount: rating.ratedCount,
  };
}

function isForbidden(
  ticket: unknown,
  user: UserContext,
  hasSiteRestriction: boolean,
) {
  const safeTicket = ticket as {
    pelanggan?: { siteId?: string | null } | null;
  };
  return (
    hasSiteRestriction &&
    user.role !== "SUPER_ADMIN" &&
    (!user.siteId || safeTicket.pelanggan?.siteId !== user.siteId)
  );
}

function countNeedsReply(input: AdminUnreadCountInput, status: TicketStatus) {
  return input.ticketRepo.countNeedsReplyAdmin(status, input.siteId);
}

function buildUnreadCountResult(
  openTickets: number,
  needsReply: number,
  waitingReply: number,
) {
  return {
    success: true,
    data: {
      count: openTickets + needsReply + waitingReply,
      breakdown: {
        openTickets,
        needsReply,
        customerRepliedWhileWaiting: waitingReply,
      },
    },
  };
}

function notFoundResult(): ServiceResult<never> {
  return { success: false, error: "Tiket tidak ditemukan", code: "NOT_FOUND" };
}

function forbiddenResult(): ServiceResult<never> {
  return { success: false, error: "Akses ditolak", code: "FORBIDDEN" };
}

type AdminTicketListInput = {
  filters: TicketFilterOptions;
  user: UserContext;
  hasSiteRestriction: boolean;
  ticketRepo: ICustomerTicketRepository;
};

type AdminTicketListResponse = {
  tickets: CustomerTicketListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: Record<string, unknown>;
};

type TicketWhereResult =
  | { success: true; data: Prisma.SupportTicketsWhereInput }
  | { success: false; error: string; code: string };

type TicketAccessResult =
  | { success: true }
  | { success: false; error: string; code: string };

type AdminTicketDetailInput = {
  id: string;
  user: UserContext;
  hasSiteRestriction: boolean;
  ticketRepo: ICustomerTicketRepository;
};

type AdminUnreadCountInput = {
  siteId?: string;
  ticketRepo: ICustomerTicketRepository;
};

type TicketListDataInput = {
  input: AdminTicketListInput;
  where: Prisma.SupportTicketsWhereInput;
  page: number;
  limit: number;
};

type TicketListResultInput = {
  ticketRepo: ICustomerTicketRepository;
  tickets: unknown[];
  total: number;
  statusSummary: Record<string, unknown>;
  rating: RatingSummary;
  page: number;
  limit: number;
};

type RatingSummary = { avgRating: number; ratedCount: number };
