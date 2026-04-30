import { firebaseRealtimeService } from "@/lib/realtime";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { AnnouncementRecord } from "./AnnouncementService.helpers";

const EMPLOYEE_ROLE_NAMES = ["EMPLOYEE", "TEKNISI"];
const ACTIVE_CUSTOMER_STATUS = "AKTIF";
const REALTIME_EVENT_TYPE = "announcement.new";

/** Publish realtime announcement in a fire-and-forget flow with error logging. */
export function publishRealtimeSafely(announcement: AnnouncementRecord) {
  void publishAnnouncementRealtime(announcement).catch((realtimeError) => {
    logger.error(
      "[Announcements] Failed to publish realtime update",
      realtimeError as Error,
      { announcementId: announcement.id },
    );
  });
}

async function publishAnnouncementRealtime(announcement: AnnouncementRecord) {
  const payload = buildRealtimePayload(announcement);
  if (announcement.target === "ADMIN") {
    await publishToAdminScope(payload);
    return;
  }
  if (announcement.target === "EMPLOYEE") {
    await publishToUserScopes(await findEmployeeIds(), payload);
    return;
  }
  if (announcement.target === "CUSTOMER") {
    await publishToUserScopes(await findActiveCustomerIds(), payload);
    return;
  }

  const [employeeIds, customerIds] = await Promise.all([
    findEmployeeIds(),
    findActiveCustomerIds(),
  ]);
  await publishToAdminScope(payload);
  await publishToUserScopes([...employeeIds, ...customerIds], payload);
}

function buildRealtimePayload(announcement: AnnouncementRecord) {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    target: announcement.target,
    isPinned: announcement.isPinned,
    createdAt: announcement.createdAt.toISOString(),
  };
}

async function publishToAdminScope(
  payload: ReturnType<typeof buildRealtimePayload>,
) {
  await firebaseRealtimeService.publish({
    type: REALTIME_EVENT_TYPE,
    scope: { kind: "admin", id: "announcements" },
    payload,
  });
}

async function publishToUserScopes(
  userIds: string[],
  payload: ReturnType<typeof buildRealtimePayload>,
) {
  await Promise.all(
    userIds.map((id) =>
      firebaseRealtimeService.publish({
        type: REALTIME_EVENT_TYPE,
        scope: { kind: "user", id },
        payload,
      }),
    ),
  );
}

async function findEmployeeIds() {
  const employees = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { name: { in: EMPLOYEE_ROLE_NAMES } },
    },
    select: { id: true },
  });
  return employees.map((employee) => employee.id);
}

async function findActiveCustomerIds() {
  const customers = await prisma.pelanggan.findMany({
    where: { status: ACTIVE_CUSTOMER_STATUS },
    select: { id: true },
  });
  return customers.map((customer) => customer.id);
}
