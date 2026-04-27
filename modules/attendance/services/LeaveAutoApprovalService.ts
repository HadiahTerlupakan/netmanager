import { prisma } from "@/modules/database";
import { getLeaveService } from "./LeaveService";

export type LeaveAutoApprovalResult = {
  approvedCount: number;
  approvedIds: string[];
  checkedDate: string;
};

type PendingLeaveRequest = {
  id: string;
  tenantId: string | null;
};

/** Auto-approves pending TUKAR_LIBUR requests scheduled for tomorrow. */
export async function autoApproveTukarLibur(
  now = new Date(),
): Promise<LeaveAutoApprovalResult> {
  const leaveService = getLeaveService();
  const tomorrow = getTomorrowStart(now);
  const tomorrowEnd = getDayEnd(tomorrow);
  const pendingRequests = await findPendingTukarLibur(tomorrow, tomorrowEnd);
  const approvedIds = await approvePendingRequests(
    pendingRequests,
    leaveService,
  );

  return {
    approvedCount: approvedIds.length,
    approvedIds,
    checkedDate: tomorrow.toISOString().split("T")[0],
  };
}

function getTomorrowStart(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

function getDayEnd(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

async function findPendingTukarLibur(startDate: Date, endDate: Date) {
  return prisma.leaveRequest.findMany({
    where: {
      type: "TUKAR_LIBUR",
      status: "PENDING",
      startDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });
}

async function approvePendingRequests(
  requests: PendingLeaveRequest[],
  leaveService: ReturnType<typeof getLeaveService>,
) {
  const approvedIds: string[] = [];

  for (const request of requests) {
    try {
      await leaveService.approveLeave(
        request.id,
        "SYSTEM_AUTO",
        request.tenantId,
      );
      approvedIds.push(request.id);
    } catch (error) {
      console.error(
        `[Cron Auto-Approve Leave] Failed to approve request ${request.id}:`,
        error,
      );
    }
  }

  return approvedIds;
}
