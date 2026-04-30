import { prisma } from "@/lib/prisma";
import { Prisma, Status } from "@prisma/client";

type ProfilePppMutationRecord = {
  id: string;
  name: string;
  localAddress: string;
  remoteAddress: string;
  dnsServer: string | null;
  sessionTimeout: number | null;
  idleTimeout: number | null;
  poolMode: string | null;
  description: string | null;
  status: string;
  siteId: string | null;
  mikroTikRouterId: string | null;
  tenantId: string | null;
  mikroTikRouter: {
    id: string;
    name: string;
  } | null;
};

export type ProfilePppDeleteRecord = ProfilePppMutationRecord & {
  hargaPaket: Array<{
    id: string;
    name: string;
  }>;
};

export interface ProfilePppListInput {
  status?: string;
  siteIds?: string[];
  siteId?: string;
}

/** Get profile PPP records for list flow. */
export async function findProfilePpps(input: ProfilePppListInput) {
  const where: Prisma.ProfilePPPWhereInput = {};

  if (input.status) {
    where.status = input.status as Status;
  }

  if (input.siteIds) {
    where.OR = [{ siteId: { in: input.siteIds } }, { siteId: null }];
  } else if (input.siteId) {
    where.OR = [{ siteId: input.siteId }, { siteId: null }];
  }

  return prisma.profilePPP.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      site: { select: { id: true, name: true } },
      mikroTikRouter: { select: { id: true, name: true, ipAddress: true } },
      _count: { select: { hargaPaket: true } },
    },
  });
}

/** Get profile PPP detail record. */
export function findProfilePppDetail(id: string) {
  return prisma.profilePPP.findUnique({
    where: { id },
    include: {
      hargaPaket: { include: { bandwidth: true } },
      mikroTikRouter: true,
    },
  });
}

/** Get profile PPP record for update flow. */
export function findProfilePppForUpdate(
  id: string,
): Promise<ProfilePppMutationRecord | null> {
  return prisma.profilePPP.findUnique({
    where: { id },
    include: {
      mikroTikRouter: true,
    },
  }) as Promise<ProfilePppMutationRecord | null>;
}

/** Get profile PPP record for delete flow. */
export function findProfilePppForDelete(
  id: string,
): Promise<ProfilePppDeleteRecord | null> {
  return prisma.profilePPP.findUnique({
    where: { id },
    include: {
      mikroTikRouter: true,
      hargaPaket: {
        select: { id: true, name: true },
      },
    },
  }) as Promise<ProfilePppDeleteRecord | null>;
}

/** Create profile PPP and include router relation. */
export function createProfilePpp(data: Prisma.ProfilePPPUncheckedCreateInput) {
  return prisma.profilePPP.create({
    data,
    include: {
      mikroTikRouter: true,
    },
  });
}

/** Update profile PPP and include router relation. */
export function updateProfilePpp(
  id: string,
  data: Prisma.ProfilePPPUncheckedUpdateInput,
) {
  return prisma.profilePPP.update({
    where: { id },
    data,
    include: {
      mikroTikRouter: true,
    },
  });
}

/** Delete profile PPP by ID. */
export async function deleteProfilePpp(id: string): Promise<void> {
  await prisma.profilePPP.delete({
    where: { id },
  });
}

/** Get routers in scope for profile broadcast. */
export function findRoutersForProfileBroadcast(input: {
  tenantId?: string | null;
  siteId?: string | null;
}) {
  return prisma.mikroTikRouter.findMany({
    where: {
      OR: [
        { tenantId: input.tenantId ?? undefined },
        { siteId: input.siteId ?? undefined },
      ],
    },
  });
}
