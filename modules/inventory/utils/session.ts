import type { Session } from "next-auth";

import { prisma } from "@/modules/database";

const SESSION_DURATION_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type InventoryAccessUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  siteId?: string | null;
};

/**
 * Build inventory access session with fresh site and role data.
 */
export async function buildInventoryAccessSession(
  user: InventoryAccessUser,
): Promise<Session> {
  const persistedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { siteId: true, role: true },
  });

  return {
    user: {
      ...user,
      siteId: persistedUser?.siteId ?? user.siteId,
      role: persistedUser?.role ?? user.role,
    },
    expires: new Date(
      Date.now() + SESSION_DURATION_IN_MILLISECONDS,
    ).toISOString(),
  } as Session;
}
