import crypto from "crypto";
import type { Prisma, TargetAudience } from "@prisma/client";
import type { AnnouncementTargetAudience } from "../domain/entities/AnnouncementEntity";
import type { IAnnouncementRepository } from "../domain/ports/IAnnouncementRepository";
import { requireAnnouncementRepositoryMethod } from "../domain/ports/IAnnouncementRepository";
import { firebaseRealtimeService } from "@/lib/realtime";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";

const ANNOUNCEMENT_PREVIEW_LIMIT = 100;
const EMPLOYEE_ROLE_NAMES = ["EMPLOYEE", "TEKNISI"];
const ADMIN_ROLE_NAMES = ["ADMIN", "SUPER_ADMIN"];
const ACTIVE_CUSTOMER_STATUS = "AKTIF";
const REALTIME_EVENT_TYPE = "announcement.new";
const ANNOUNCEMENT_LINK = "/announcement";
export const RECENT_READER_LIMIT = 10;
export const UNKNOWN_USER_NAME = "Unknown User";
export const UNKNOWN_CUSTOMER_NAME = "Unknown Customer";
export const ANONYMOUS_READER_NAME = "Anonymous";
export const DEFAULT_PORTAL = "admin";
export const DEFAULT_MOBILE_PORTAL = "mobile";

export type MobileAnnouncementPortal = "customer" | "employee" | "admin";

const MOBILE_PORTAL_TARGETS: Record<
  MobileAnnouncementPortal,
  AnnouncementTargetAudience[]
> = {
  customer: ["ALL", "CUSTOMER"],
  employee: ["ALL", "EMPLOYEE"],
  admin: ["ALL", "ADMIN"],
};

export interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  target: string;
  isPinned: boolean;
  createdAt: Date;
}

export interface AnnouncementCreateInput {
  title: string;
  content: string;
  target: AnnouncementTargetAudience;
  isActive?: boolean;
  isPinned?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AnnouncementUpdateInput {
  title?: string;
  content?: string;
  target?: AnnouncementTargetAudience;
  isActive?: boolean;
  isPinned?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AnnouncementFilters {
  target?: string;
  activeOnly: boolean;
  portal?: string | null;
}

export interface AnnouncementReadActor {
  userId: string;
}

export interface CustomerAnnouncementReadActor {
  pelangganId: string;
}

export interface MobileAnnouncementActor {
  userId: string;
  tenantId?: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
}

/** Resolve repository method safely for hybrid migration state. */
type RepositoryMethod = (...args: never[]) => unknown;

export function getAnnouncementRepositoryMethod<
  TMethod extends RepositoryMethod,
>(
  repository: IAnnouncementRepository,
  method: TMethod | undefined,
  methodName: string,
): TMethod {
  return requireAnnouncementRepositoryMethod(method, methodName).bind(
    repository,
  ) as TMethod;
}

/** Build the database where clause for announcement listing. */
export function buildAnnouncementWhere(
  filters: AnnouncementFilters,
  now: Date,
) {
  if (filters.portal === "customer") {
    return buildPortalAnnouncementWhere(["ALL", "CUSTOMER"], now);
  }
  if (filters.portal === "employee") {
    return buildPortalAnnouncementWhere(["ALL", "EMPLOYEE"], now);
  }
  if (filters.portal === "admin") {
    return buildPortalAnnouncementWhere(["ALL", "ADMIN"], now);
  }

  const target = normalizeTargetAudience(filters.target);
  return {
    ...(target ? { target } : {}),
    ...(filters.activeOnly ? { isActive: true } : {}),
  };
}

/** Build mobile announcement filter by portal and tenant. */
export function buildMobileAnnouncementWhere(
  tenantId: string | null,
  portal: MobileAnnouncementPortal,
  now: Date,
) {
  return {
    target: { in: MOBILE_PORTAL_TARGETS[portal].slice() },
    isActive: true,
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
    ...(tenantId ? { tenantId } : {}),
  };
}

/** Determine mobile portal from authenticated user role. */
export function resolveMobilePortal(
  role?: string | null,
  isSuperAdmin?: boolean,
) {
  const normalizedRole = role?.toUpperCase() ?? "";
  if (normalizedRole.includes("CUSTOMER")) {
    return "customer" as const;
  }
  if (isSuperAdmin || normalizedRole.includes("ADMIN")) {
    return "admin" as const;
  }
  return "employee" as const;
}

/** Normalize route target input into a valid announcement audience. */
export function normalizeTargetAudience(target?: string) {
  if (!target) {
    return undefined;
  }

  const validTargets: AnnouncementTargetAudience[] = [
    "ALL",
    "ADMIN",
    "EMPLOYEE",
    "CUSTOMER",
  ];
  return validTargets.includes(target) ? target : undefined;
}

/** Build create data for an announcement row. */
export function buildAnnouncementCreateData(
  input: AnnouncementCreateInput,
  createdBy: string,
  isAnnouncementActive: boolean,
) {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    content: input.content,
    target: input.target,
    isActive: isAnnouncementActive,
    isPinned: input.isPinned ?? false,
    startDate: input.startDate ? new Date(input.startDate) : new Date(),
    endDate: input.endDate ? new Date(input.endDate) : null,
    createdBy,
    updatedAt: new Date(),
  };
}

/** Build update data for an announcement row. */
export function buildAnnouncementUpdateData(input: AnnouncementUpdateInput) {
  return {
    title: input.title,
    content: input.content,
    target: input.target,
    isActive: input.isActive,
    isPinned: input.isPinned,
    ...(input.startDate !== undefined
      ? { startDate: input.startDate ? new Date(input.startDate) : null }
      : {}),
    ...(input.endDate !== undefined
      ? { endDate: input.endDate ? new Date(input.endDate) : null }
      : {}),
  };
}

/** Ensure one announcement exists. */
export async function ensureAnnouncementExists(
  repository: IAnnouncementRepository,
  id: string,
  buildError: (message: string, status: number) => Error,
) {
  const finder = getAnnouncementRepositoryMethod(
    repository,
    repository.findExistingById,
    "findExistingById",
  );
  const announcement = await finder(id);
  if (!announcement) {
    throw buildError("Pengumuman tidak ditemukan", 404);
  }
}

/** Ensure one announcement exists inside the current tenant scope. */
export async function ensureAnnouncementExistsForTenant(
  repository: IAnnouncementRepository,
  id: string,
  tenantId: string | null,
  buildError: (message: string, status: number) => Error,
) {
  const finder = getAnnouncementRepositoryMethod(
    repository,
    repository.findExistingByIdAndTenant,
    "findExistingByIdAndTenant",
  );
  const announcement = await finder(id, tenantId);
  if (!announcement) {
    throw buildError("Pengumuman tidak ditemukan", 404);
  }
}

/** Find announcement summary fields for stats output. */
export function findAnnouncementSummary(
  repository: IAnnouncementRepository,
  id: string,
) {
  return getAnnouncementRepositoryMethod(
    repository,
    repository.findSummaryById,
    "findSummaryById",
  )(id);
}

/** Find recent readers for one announcement. */
export function findRecentReaders(
  repository: IAnnouncementRepository,
  id: string,
) {
  return getAnnouncementRepositoryMethod(
    repository,
    repository.findRecentReaders,
    "findRecentReaders",
  )(id, RECENT_READER_LIMIT);
}

/** Add resolved reader names without changing the existing response shape. */
export async function attachReaderNames(
  repository: IAnnouncementRepository,
  recentReaders: Awaited<ReturnType<typeof findRecentReaders>>,
) {
  const [userMap, pelangganMap] = await Promise.all([
    findUserNameMap(repository, recentReaders),
    findPelangganNameMap(repository, recentReaders),
  ]);

  return recentReaders.map((reader) => ({
    ...reader,
    readerName: resolveReaderName(reader, userMap, pelangganMap),
  }));
}

async function findUserNameMap(
  repository: IAnnouncementRepository,
  recentReaders: Awaited<ReturnType<typeof findRecentReaders>>,
) {
  const userIds = recentReaders.flatMap((reader) =>
    reader.userId ? [reader.userId] : [],
  );
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const finder = getAnnouncementRepositoryMethod(
    repository,
    repository.findUserNames,
    "findUserNames",
  );
  const users = await finder(userIds);
  return new Map(users.map((user) => [user.id, user.name]));
}

async function findPelangganNameMap(
  repository: IAnnouncementRepository,
  recentReaders: Awaited<ReturnType<typeof findRecentReaders>>,
) {
  const pelangganIds = recentReaders.flatMap((reader) =>
    reader.pelangganId ? [reader.pelangganId] : [],
  );
  if (pelangganIds.length === 0) {
    return new Map<string, string>();
  }

  const finder = getAnnouncementRepositoryMethod(
    repository,
    repository.findCustomerNames,
    "findCustomerNames",
  );
  const pelanggans = await finder(pelangganIds);
  return new Map(pelanggans.map((pelanggan) => [pelanggan.id, pelanggan.name]));
}

function resolveReaderName(
  reader: Awaited<ReturnType<typeof findRecentReaders>>[number],
  userMap: Map<string, string>,
  pelangganMap: Map<string, string>,
) {
  if (reader.userId) {
    return userMap.get(reader.userId) || UNKNOWN_USER_NAME;
  }
  if (reader.pelangganId) {
    return pelangganMap.get(reader.pelangganId) || UNKNOWN_CUSTOMER_NAME;
  }
  return ANONYMOUS_READER_NAME;
}

/** Log successful announcement creation. */
export function logAnnouncementCreation(
  announcement: AnnouncementRecord,
  createdBy: string,
) {
  return logger.logActivity({
    action: "CREATE",
    subject: "Announcement",
    details: {
      id: announcement.id,
      title: announcement.title,
      target: announcement.target,
    },
    userId: createdBy,
  });
}

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

/** Send push notifications and persistent notifications for employees/admins. */
export async function sendEmployeeAnnouncementNotifications(
  announcement: AnnouncementRecord,
): Promise<void> {
  try {
    const targetAudience = announcement.target as TargetAudience;
    const users = await prisma.user.findMany({
      where: buildNotificationUserFilter(targetAudience),
      select: { id: true, pushToken: true },
    });
    const usersOnLeave = await findUsersOnLeave(users.map((user) => user.id));
    const tokens = users
      .filter((user) => !usersOnLeave.has(user.id))
      .map((user) => user.pushToken)
      .filter((token): token is string => !!token);

    if (tokens.length > 0) {
      const { sendExpoPushNotifications } = await import("@/lib/expo");
      await sendExpoPushNotifications(
        tokens,
        announcement.title,
        buildAnnouncementPreview(announcement.content),
        { announcementId: announcement.id, url: ANNOUNCEMENT_LINK },
      );
    }

    await createPersistentAnnouncementNotifications(
      announcement,
      buildNotificationDbUserFilter(targetAudience),
    );
  } catch (pushError) {
    logger.error(
      "[Announcements] Failed to send push notifications",
      pushError as Error,
    );
  }
}

async function createPersistentAnnouncementNotifications(
  announcement: AnnouncementRecord,
  where: Prisma.UserWhereInput,
) {
  const targetedUsers = await prisma.user.findMany({
    where,
    select: { id: true },
  });
  if (targetedUsers.length === 0) {
    return;
  }

  await prisma.notifications.createMany({
    data: targetedUsers.map((user) => ({
      id: crypto.randomUUID(),
      type: "ANNOUNCEMENT",
      title: announcement.title,
      message: buildAnnouncementPreview(announcement.content),
      userId: user.id,
      sourceType: "ANNOUNCEMENT",
      sourceId: announcement.id,
      isRead: false,
      priority: "NORMAL",
      createdAt: new Date(),
    })),
  });
}

function buildNotificationUserFilter(
  target: TargetAudience,
): Prisma.UserWhereInput {
  return {
    pushToken: { not: null },
    isActive: true,
    ...buildRoleFilter(target),
  };
}

function buildNotificationDbUserFilter(
  target: TargetAudience,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    ...buildRoleFilter(target),
  };
}

function buildRoleFilter(target: TargetAudience): Prisma.UserWhereInput {
  if (target === "EMPLOYEE") {
    return { role: { name: { in: EMPLOYEE_ROLE_NAMES } } };
  }
  if (target === "ADMIN") {
    return { role: { name: { in: ADMIN_ROLE_NAMES } } };
  }
  return {};
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

async function findUsersOnLeave(userIds: string[]) {
  if (userIds.length === 0) {
    return new Set<string>();
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const usersOnLeave = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: now },
      endDate: { gte: startOfToday },
      userId: { in: userIds },
    },
    select: { userId: true },
  });
  return new Set(usersOnLeave.map((user) => user.userId));
}

function buildPortalAnnouncementWhere(
  targets: AnnouncementTargetAudience[],
  now: Date,
) {
  return {
    target: { in: targets },
    isActive: true,
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
  };
}

function buildAnnouncementPreview(content: string) {
  const preview = content.substring(0, ANNOUNCEMENT_PREVIEW_LIMIT);
  return content.length > ANNOUNCEMENT_PREVIEW_LIMIT
    ? `${preview}...`
    : preview;
}
