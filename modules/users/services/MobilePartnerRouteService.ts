import { Prisma } from "../repositories/prisma-boundary";

import { filterInvitablePartnersToday } from "@/modules/work-order";
import { prisma } from "@/modules/database";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Partner work order harus benar-benar bisa mengerjakan work order.
 *
 * Penyaringnya dulu hanya `isActive` dan `tenantId`, sehingga pemilih yang
 * berbunyi "Cari nama teknisi" menawarkan seluruh isi tenant — staf finance,
 * sales, dan admin ikut terdaftar. Mereka tidak memegang resource ini sama
 * sekali, jadi diundang pun tidak bisa berbuat apa-apa di work order itu;
 * yang tersisa hanya daftar yang menyesatkan dan undangan yang mubazir.
 *
 * Disaring lewat izin, bukan nama peran, supaya tetap benar bila sebuah tenant
 * menamai peran lapangannya dengan sebutan lain.
 */
const RESOURCE_WORK_ORDER_MOBILE = "m_work_order";

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
    role: {
      permission: { some: { resource: RESOURCE_WORK_ORDER_MOBILE } },
    },
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
