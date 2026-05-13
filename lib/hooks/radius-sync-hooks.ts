import { clientLogger } from "@/lib/client-logger";
/**
 * RADIUS Auto-Sync Hooks
 *
 * @deprecated Sejak event-driven refactor (Phase 2). File ini akan dihapus di Phase 5.
 * Sync MikroTik/RADIUS sekarang via `CustomerEventDispatcher` + handler
 * di `modules/network/services/event-handlers/customer-status.handler.ts`.
 *
 * JANGAN tambah caller baru. Gunakan `CustomerEventDispatcher.onCreated/onUpdated/
 * onSuspended/onActivated/onIsolated/onDeleted` yang sesuai.
 */

import { PrismaClient, Status } from "@prisma/client";
import { RadiusSyncService } from "@/modules/network";
import { prisma as defaultPrisma } from "@/lib/prisma";

export interface SyncResult {
  success: boolean;
  error?: string;
}

export interface CustomerChange {
  statusChanged?: boolean;
  oldStatus?: Status;
  newStatus?: Status;
  packageChanged?: boolean;
  passwordChanged?: boolean;
  oldUsername?: string;
  newUsername?: string;
}

/**
 * Hook: After customer created
 * Automatically syncs new customer to RADIUS
 */
export async function afterCustomerCreate(
  _prisma: PrismaClient | undefined | null,
  customerId: string,
): Promise<SyncResult> {
  try {
    const syncService = new RadiusSyncService();
    await syncService.syncSingleCustomer(customerId);

    clientLogger.info(
      `[RADIUS Hook] Customer created and synced: ${customerId}`,
    );
    return { success: true };
  } catch (error) {
    clientLogger.error("[RADIUS Hook] Error in afterCustomerCreate:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Terjadi kesalahan",
    };
  }
}

/**
 * Hook: After customer updated
 * Smart sync based on what changed:
 * - Status change → Enable/disable in RADIUS
 * - Package change → Update bandwidth
 * - Password change → Update RADIUS password
 * - Other changes → Full sync
 */
export async function afterCustomerUpdate(
  prisma: PrismaClient | undefined | null,
  customerId: string,
  changes: CustomerChange,
): Promise<SyncResult> {
  const db = prisma || defaultPrisma;
  try {
    const syncService = new RadiusSyncService();
    const isUsernameRenamed = Boolean(
      changes.oldUsername &&
      changes.newUsername &&
      changes.oldUsername !== changes.newUsername,
    );

    if (changes.statusChanged && changes.newStatus) {
      await syncService.handleStatusChange(customerId, changes.newStatus);
      clientLogger.info(
        `[RADIUS Hook] Customer status changed: ${customerId} → ${changes.newStatus}`,
      );
    } else {
      await syncService.syncSingleCustomer(customerId);
      clientLogger.info(
        `[RADIUS Hook] Customer updated and synced: ${customerId}`,
      );
    }

    if (!isUsernameRenamed) {
      return { success: true };
    }

    const customer = await db.pelanggan.findUnique({
      where: { id: customerId },
      select: { tenantId: true },
    });

    if (!customer?.tenantId || !changes.oldUsername) {
      return { success: true };
    }

    const verification = await syncService.verifyCustomerSync(customerId);
    if (!verification.synced) {
      return {
        success: false,
        error: "Sinkronisasi username baru gagal diverifikasi",
      };
    }

    await syncService.deleteRadiusUserByUsername(
      changes.oldUsername,
      customer.tenantId,
    );

    return { success: true };
  } catch (error) {
    clientLogger.error("[RADIUS Hook] Error in afterCustomerUpdate:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Terjadi kesalahan",
    };
  }
}

/**
 * Hook: Before customer deleted
 * Removes customer from RADIUS before deleting from database
 */
export async function beforeCustomerDelete(
  prisma: PrismaClient | undefined | null,
  username: string,
): Promise<SyncResult> {
  const db = prisma || defaultPrisma;
  try {
    const syncService = new RadiusSyncService();

    const user = await db.pelanggan.findFirst({
      where: { username },
      select: { tenantId: true },
    });

    if (user?.tenantId) {
      await syncService.deleteRadiusUserByUsername(username, user.tenantId);
      clientLogger.info(
        `[RADIUS Hook] Customer removed from RADIUS: ${username}`,
      );
    }

    return { success: true };
  } catch (error) {
    clientLogger.error("[RADIUS Hook] Error in beforeCustomerDelete:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Terjadi kesalahan",
    };
  }
}

/**
 * Helper: Log sync result
 */
export function logSyncResult(
  operation: string,
  customerId: string,
  result: SyncResult,
): void {
  if (result.success) {
    clientLogger.info(`[RADIUS Sync] ${operation} - Success: ${customerId}`);
  } else {
    clientLogger.error(
      `[RADIUS Sync] ${operation} - Failed: ${customerId}`,
      result.error,
    );
  }
}

/**
 * Helper: Determine if sync is needed
 * Skip sync for test/demo accounts or specific conditions
 */
export function shouldSync(username: string, _status?: Status): boolean {
  // Skip sync for demo accounts
  if (username.startsWith("demo_") || username.startsWith("test_")) {
    return false;
  }

  // Add other conditions as needed
  return true;
}
