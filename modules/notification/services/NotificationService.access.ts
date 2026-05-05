import type { Prisma } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { UserLookupService } from "@/modules/users";
import {
  buildExcludedTypesSqlCondition,
  buildNotificationAccessWhere,
  buildNotificationMutationPayload,
  buildSiteSqlCondition,
  buildTenantSqlCondition,
  getMissingTenantId,
  resolveNotificationQueryOptions,
  type NotificationAccessScope,
  type NotificationAccessScopeInput,
} from "./NotificationService.helpers";
import type { NotificationType } from "./NotificationService.types";
import type { NotificationRepository } from "../repositories/NotificationRepository";

type NotificationAccessOptions = {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  type?: NotificationType;
  excludeTypes?: NotificationType[];
  siteId?: string;
  departmentId?: string;
};

export async function getNotificationsForUserAccess(input: {
  repository: NotificationRepository;
  userLookupService: UserLookupService;
  userId: string;
  options?: NotificationAccessOptions;
}) {
  const where = await buildScopedNotificationWhere(
    input.userId,
    input.options,
    input.userLookupService,
  );
  applyNotificationListFilters(where, input.options);
  return findNotificationPage(input.repository, where, input.options);
}

export async function getReadableNotificationForUserAccess(input: {
  repository: NotificationRepository;
  userLookupService: UserLookupService;
  notificationId: string;
  userId: string;
  options?: { departmentId?: string; siteId?: string };
}) {
  const where = await buildScopedNotificationWhere(
    input.userId,
    input.options,
    input.userLookupService,
  );
  return input.repository.findFirst({ id: input.notificationId, ...where });
}

export async function getUnreadCountAccess(input: {
  repository: NotificationRepository;
  userId: string;
  excludeTypes?: NotificationType[];
  siteId?: string;
}): Promise<number> {
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();

  return input.repository.getUnreadCountRaw(
    input.userId,
    buildExcludedTypesSqlCondition(input.excludeTypes),
    buildSiteSqlCondition(input.siteId),
    buildTenantSqlCondition(isSuperAdmin, tenantId),
  );
}

export async function markAllAsReadAccess(input: {
  repository: NotificationRepository;
  userLookupService: UserLookupService;
  userId: string;
  type?: NotificationType;
  siteId?: string;
}) {
  const where = await buildUnreadNotificationWhere(
    input.userId,
    input.siteId,
    input.userLookupService,
    input.type,
  );
  return input.repository.updateMany(where, buildNotificationMutationPayload());
}

async function buildScopedNotificationWhere(
  userId: string,
  options:
    | { departmentId?: string; siteId?: string }
    | NotificationAccessOptions
    | undefined,
  userLookupService: UserLookupService,
): Promise<Prisma.NotificationsWhereInput> {
  const accessInput = buildNotificationAccessInput(userId, options);
  const scope = await resolveNotificationAccessScope(
    accessInput,
    userLookupService,
  );
  return buildNotificationAccessWhere(accessInput, scope);
}

function buildNotificationAccessInput(
  userId: string,
  options?: { departmentId?: string; siteId?: string },
): NotificationAccessScopeInput {
  return {
    userId,
    departmentId: options?.departmentId,
    siteId: options?.siteId,
  };
}

function applyNotificationListFilters(
  where: Prisma.NotificationsWhereInput,
  options?: NotificationAccessOptions,
) {
  if (options?.unreadOnly) {
    where.isRead = false;
  }
  if (options?.type) {
    where.type = options.type;
  }
  if (options?.excludeTypes?.length) {
    where.type = { notIn: options.excludeTypes };
  }
}

async function findNotificationPage(
  repository: NotificationRepository,
  where: Prisma.NotificationsWhereInput,
  options?: NotificationAccessOptions,
) {
  const [notifications, total] = await Promise.all([
    repository.findManyForUser(where, resolveNotificationQueryOptions(options)),
    repository.countWhere(where),
  ]);
  return { notifications, total };
}

async function buildUnreadNotificationWhere(
  userId: string,
  siteId: string | undefined,
  userLookupService: UserLookupService,
  type?: NotificationType,
): Promise<Prisma.NotificationsWhereInput> {
  const where = await buildScopedNotificationWhere(
    userId,
    { siteId },
    userLookupService,
  );
  where.isRead = false;
  if (type) {
    where.type = type;
  }
  return where;
}

async function resolveNotificationAccessScope(
  input: NotificationAccessScopeInput,
  userLookupService: UserLookupService,
): Promise<NotificationAccessScope> {
  const user = input.departmentId
    ? null
    : await userLookupService.findByIdWithDepartment(input.userId);
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const effectiveTenantId =
    !isSuperAdmin && !tenantId ? getMissingTenantId() : tenantId;

  return {
    departmentId: input.departmentId || user?.departmentId || undefined,
    tenantCondition: !isSuperAdmin ? { tenantId: effectiveTenantId } : {},
  };
}
