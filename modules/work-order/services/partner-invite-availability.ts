import { prisma } from "@/modules/database";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

export const PARTNER_ON_LEAVE_ERROR_MESSAGE =
  "Partner sedang libur dan belum check-in lembur hari ini";

export async function canInvitePartnerToday(
  userId: string,
  tenantId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const startOfDay = toStartOfDay(now);
  const endOfDay = toEndOfDay(now);

  const leave = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      tenantId,
      status: "APPROVED",
      startDate: { lte: endOfDay },
      endDate: { gte: startOfDay },
    },
    select: { id: true },
  });

  if (!leave) {
    return true;
  }

  const activeOvertime = await prisma.overtime.findFirst({
    where: {
      userId,
      tenantId,
      status: "IN_PROGRESS",
      startTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: { id: true },
  });

  return Boolean(activeOvertime);
}

export async function filterInvitablePartnersToday<T extends { id: string }>(
  partners: T[],
  tenantId: string,
  now: Date = new Date(),
): Promise<T[]> {
  const availability = await Promise.all(
    partners.map(async (partner) => ({
      partner,
      canInvite: await canInvitePartnerToday(partner.id, tenantId, now),
    })),
  );

  return availability
    .filter((item) => item.canInvite)
    .map((item) => item.partner);
}
