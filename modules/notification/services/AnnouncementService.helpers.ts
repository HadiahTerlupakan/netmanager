import crypto from "crypto";
import { logger } from "@/lib/logger";
import type { AnnouncementTargetAudience } from "../domain/entities/AnnouncementEntity";
import type { IAnnouncementRepository } from "../domain/ports/IAnnouncementRepository";
import { requireAnnouncementRepositoryMethod } from "../domain/ports/IAnnouncementRepository";

export { sendEmployeeAnnouncementNotifications } from "./AnnouncementNotification.helpers";
export { publishRealtimeSafely } from "./AnnouncementRealtime.helpers";

export const RECENT_READER_LIMIT = 10;
export const UNKNOWN_USER_NAME = "Unknown User";
export const UNKNOWN_CUSTOMER_NAME = "Unknown Customer";
export const ANONYMOUS_READER_NAME = "Anonymous";
export const DEFAULT_PORTAL = "admin";
export const DEFAULT_MOBILE_PORTAL = "mobile";

export type MobileAnnouncementPortal = "customer" | "employee" | "admin";

type RepositoryMethod = (...args: never[]) => unknown;

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
  accessAdminPanel?: boolean;
}

/** Resolve repository method safely for hybrid migration state. */
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

  // Tanpa portal: filter target opsional + activeOnly. Tidak menyembunyikan
  // target=ADMIN di sini karena route ini sudah dijaga RBAC
  // (`announcement:read`); customer/employee selalu memanggil dengan portal.
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
  accessAdminPanel?: boolean,
) {
  const normalizedRole = role?.toUpperCase() ?? "";
  if (normalizedRole.includes("CUSTOMER")) {
    return "customer" as const;
  }
  if (isSuperAdmin || accessAdminPanel) {
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
