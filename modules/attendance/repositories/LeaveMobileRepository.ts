import { prisma } from "@/lib/prisma";
import {
  toLeaveApproverEntity,
  toLeaveRequesterContextEntity,
} from "../mappers/AttendanceDomainMapper";

export class LeaveMobileRepository {
  /** Get leave requester context for mobile submission. */
  async findRequesterContext(userId: string, tenantId: string) {
    const requester = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        workingHourMode: true,
        workDays: true,
        name: true,
        siteId: true,
      },
    });
    return requester ? toLeaveRequesterContextEntity(requester) : null;
  }

  /** Get approver admin IDs for leave notification. */
  async findApproverIdsForMobileLeaveNotification(input: {
    tenantId: string;
    siteId?: string | null;
  }) {
    const siteScope = input.siteId
      ? [
          {
            OR: [
              { siteId: input.siteId },
              { siteId: null },
              { userSites: { some: { siteId: input.siteId } } },
            ],
          },
        ]
      : [];
    const approvers = await prisma.user.findMany({
      where: {
        isActive: true,
        tenantId: input.tenantId,
        OR: [
          { role: { isSuperAdmin: true } },
          {
            AND: [{ role: { canReceiveWhatsappApproval: true } }, ...siteScope],
          },
        ],
      },
      select: { id: true, phone: true },
    });
    return approvers.map(toLeaveApproverEntity);
  }
}
