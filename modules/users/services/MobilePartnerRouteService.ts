import { Prisma } from "@prisma/client";

import { filterInvitablePartnersToday } from "@/modules/work-order";
import { prisma } from "@/modules/database";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export interface MobilePartnerFilters {
  tenantId: string;
  userId: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Mengambil daftar partner mobile yang dapat diundang hari ini. */
export async function getMobilePartners(filters: MobilePartnerFilters) {
  const page = normalizePositiveNumber(filters.page, DEFAULT_PAGE);
  const limit = normalizePositiveNumber(filters.limit, DEFAULT_LIMIT);
  const where = buildPartnerWhere(filters);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: buildPartnerSelect(),
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where }),
  ]);

  return buildPartnerResponse(
    await filterInvitablePartnersToday(users, filters.tenantId),
    total,
    page,
    limit,
  );
}

function normalizePositiveNumber(value: number | undefined, fallback: number) {
  return typeof value === "number" && value > 0 ? value : fallback;
}

function buildPartnerWhere(
  filters: MobilePartnerFilters,
): Prisma.UserWhereInput {
  const search = filters.search?.trim();
  return {
    id: { not: filters.userId },
    isActive: true,
    tenantId: filters.tenantId,
    ...(search ? { OR: buildSearchFilters(search) } : {}),
  };
}

function buildSearchFilters(search: string): Prisma.UserWhereInput[] {
  return [
    { name: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
  ];
}

function buildPartnerSelect() {
  return {
    id: true,
    name: true,
    role: { select: { name: true } },
    sites: { select: { name: true } },
  } satisfies Prisma.UserSelect;
}

function buildPartnerResponse(
  data: Awaited<ReturnType<typeof filterInvitablePartnersToday>>,
  total: number,
  page: number,
  limit: number,
) {
  return {
    data,
    message: "Berhasil mengambil daftar partner",
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
