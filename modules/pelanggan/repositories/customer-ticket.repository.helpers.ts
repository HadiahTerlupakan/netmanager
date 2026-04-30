import { buildPaginationMeta } from "@/lib/utils/pagination";
import { Prisma, TicketStatus } from "@prisma/client";

export const ACTIVE_UNREAD_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.IN_PROGRESS,
];

/** Build customer ticket list filter for repository queries. */
export const buildCustomerTicketWhere = (
  pelangganId: string,
  status?: string,
): Prisma.SupportTicketsWhereInput => ({
  pelangganId,
  ...(status ? { status: status as TicketStatus } : {}),
});

/** Build pagination metadata for customer ticket list. */
export const buildCustomerTicketPagination = (
  page: number,
  limit: number,
  total: number,
) => buildPaginationMeta({ page, limit, total });
