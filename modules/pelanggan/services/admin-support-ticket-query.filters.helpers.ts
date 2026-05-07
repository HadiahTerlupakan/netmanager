import {
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { isSuperAdmin } from "@/lib/auth";

import type {
  TicketFilterOptions,
  UserContext,
} from "./AdminSupportTicketService";

export type TicketWhereResult =
  | { success: true; data: Prisma.SupportTicketsWhereInput }
  | { success: false; error: string; code: string };

export function buildTicketListWhere(
  input: AdminTicketListInput,
): TicketWhereResult {
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
  if (!hasSiteRestriction || isSuperAdmin(user)) {
    return { success: true as const };
  }
  if (!user.siteId) {
    return {
      success: false as const,
      error: "User tidak memiliki akses site",
      code: "FORBIDDEN",
    };
  }
  where.pelanggan = { siteId: user.siteId };
  return { success: true as const };
}

function applyTicketFilters(
  where: Prisma.SupportTicketsWhereInput,
  filters: TicketFilterOptions,
  user: UserContext,
) {
  if (filters.status && Object.values(TicketStatus).includes(filters.status)) {
    where.status = filters.status;
  }
  if (
    filters.category &&
    Object.values(TicketCategory).includes(filters.category)
  ) {
    where.category = filters.category;
  }
  if (
    filters.priority &&
    Object.values(TicketPriority).includes(filters.priority)
  ) {
    where.priority = filters.priority;
  }
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

type AdminTicketListInput = {
  filters: TicketFilterOptions;
  user: UserContext;
  hasSiteRestriction: boolean;
};

type TicketAccessResult =
  | { success: true }
  | { success: false; error: string; code: string };
