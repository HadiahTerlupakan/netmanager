import { logger, logActivitySafe } from "@/lib/logger";
import type {
  MikroTikRouterCreateData,
  MikroTikRouterUpdateData,
} from "../domain/entities/MikroTikRouterEntity";

function buildCreateLogDetails(
  routerId: string,
  createData: MikroTikRouterCreateData,
) {
  return { id: routerId, name: createData.name, ip: createData.ipAddress };
}

function buildUpdateLogDetails(
  routerId: string,
  changes: MikroTikRouterUpdateData,
) {
  return { id: routerId, changes };
}

function buildDeleteLogDetails(routerId: string) {
  return { id: routerId };
}

function buildApiUserLogDetails(routerId: string, username?: string) {
  return { routerId, username };
}

function logApiUserError(error: unknown): void {
  logger.error("Logging failed", error);
}

/** Catat aktivitas pembuatan router MikroTik. */
export function logRouterCreateActivity(
  userId: string,
  routerId: string,
  createData: MikroTikRouterCreateData,
): void {
  logActivitySafe({
    action: "CREATE",
    subject: "MikroTik Router",
    userId,
    details: buildCreateLogDetails(routerId, createData),
  });
}

/** Catat aktivitas perubahan konfigurasi router MikroTik. */
export function logRouterUpdateActivity(
  userId: string,
  routerId: string,
  changes: MikroTikRouterUpdateData,
): void {
  logActivitySafe({
    action: "UPDATE",
    subject: "MikroTik Router",
    userId,
    details: buildUpdateLogDetails(routerId, changes),
  });
}

/** Catat aktivitas penghapusan router MikroTik. */
export function logRouterDeleteActivity(
  userId: string,
  routerId: string,
): void {
  logActivitySafe({
    action: "DELETE",
    subject: "MikroTik Router",
    userId,
    details: buildDeleteLogDetails(routerId),
  });
}

/** Catat aktivitas pembuatan user API router. */
export function logGeneratedApiUserActivity(
  userId: string,
  routerId: string,
  username?: string,
): void {
  try {
    logActivitySafe({
      action: "CREATE",
      subject: "MikroTik API User",
      userId,
      details: buildApiUserLogDetails(routerId, username),
    });
  } catch (error: unknown) {
    logApiUserError(error);
  }
}
