import { Prisma } from "@prisma/client";

import { DEFAULT_USER_SEARCH_LIMIT } from "./chat-repository.constants";

/** Build user search filter for chat participant lookup. */
export function buildUserSearchWhere(
  tenantId: string,
  search?: string,
  excludeUserId?: string,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    tenantId,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/** Build user search query options for chat creation. */
export function buildUserSearchQuery(
  tenantId: string,
  search?: string,
  excludeUserId?: string,
) {
  return {
    where: buildUserSearchWhere(tenantId, search, excludeUserId),
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      departments: { select: { name: true } },
      sites: { select: { name: true } },
    },
    take: DEFAULT_USER_SEARCH_LIMIT,
    orderBy: { name: "asc" as const },
  };
}
