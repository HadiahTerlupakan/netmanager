/**
 * NOTE: Prisma import is intentionally kept here for type safety.
 * This helper uses Prisma.SupportTicketsWhereInput for dynamic query building.
 * Removing this would require duplicating all Prisma types or losing type safety.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import { Prisma } from "@prisma/client";
import { TicketStatus } from "../types/pelanggan.enums";
import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";

const OPEN_TICKET_STATUS = TicketStatus.OPEN;

/** Hitung ringkasan status tiket admin. */
export async function getStatusCounts(
  ticketRepo: ICustomerTicketRepository,
  baseWhere: Prisma.SupportTicketsWhereInput,
) {
  const counts = await ticketRepo.getStatusCounts(baseWhere);
  const countMap = buildStatusCountMap(counts);
  return buildStatusSummary(countMap);
}

/** Hitung rata-rata rating dari balasan tiket closed. */
export async function calculateAverageRating(
  ticketRepo: ICustomerTicketRepository,
  baseWhere: Prisma.SupportTicketsWhereInput,
) {
  const closedTickets = await ticketRepo.getClosedTicketsWithReplies(baseWhere);
  return closedTickets.reduce(
    (summary, ticket) => addTicketRating(summary, ticket.replies[0]?.message),
    { avgRating: 0, ratedCount: 0, totalRating: 0 },
  );
}

/** Bentuk filter tiket open untuk unread count. */
export function buildUnreadOpenWhere(
  siteId?: string,
): Prisma.SupportTicketsWhereInput {
  if (!siteId) return { status: OPEN_TICKET_STATUS };
  return { status: OPEN_TICKET_STATUS, pelanggan: { siteId } };
}

function buildStatusCountMap(
  counts: Awaited<ReturnType<ICustomerTicketRepository["getStatusCounts"]>>,
) {
  return counts.reduce(
    (acc, curr) => ({ ...acc, [curr.status]: curr._count.status }),
    {} as Record<string, number>,
  );
}

function buildStatusSummary(countMap: Record<string, number>) {
  const open = countMap[TicketStatus.OPEN] || 0;
  const inProgress = countMap[TicketStatus.IN_PROGRESS] || 0;
  const waitingCustomer = countMap[TicketStatus.WAITING_CUSTOMER] || 0;
  const resolved = countMap[TicketStatus.RESOLVED] || 0;
  const closed = countMap[TicketStatus.CLOSED] || 0;
  return {
    total: open + inProgress + waitingCustomer + resolved + closed,
    open,
    inProgress,
    waitingCustomer,
    resolved,
    closed,
  };
}

function addTicketRating(
  summary: RatingAccumulator,
  message?: string,
): RatingAccumulator {
  const rating = message ? parseRating(message) : 0;
  if (rating === 0) return summary;
  const totalRating = summary.totalRating + rating;
  const ratedCount = summary.ratedCount + 1;
  return { totalRating, ratedCount, avgRating: totalRating / ratedCount };
}

function parseRating(message: string) {
  if (message.includes("⭐⭐⭐⭐⭐")) return 5;
  if (message.includes("⭐⭐⭐⭐")) return 4;
  if (message.includes("⭐⭐⭐")) return 3;
  if (message.includes("⭐⭐")) return 2;
  if (message.includes("⭐")) return 1;
  return 0;
}

type RatingAccumulator = {
  avgRating: number;
  ratedCount: number;
  totalRating: number;
};
