/**
 * RADIUS Auto-Sync Hooks
 * 
 * Reusable functions to automatically sync customer changes to RADIUS.
 * Called after customer create/update/delete operations.
 */

import { PrismaClient, Status } from '@prisma/client';
import { RadiusSyncService } from '../services/radius-sync-service';

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
}

/**
 * Hook: After customer created
 * Automatically syncs new customer to RADIUS
 */
export async function afterCustomerCreate(
    prisma: PrismaClient,
    customerId: string
): Promise<SyncResult> {
    try {
        const syncService = new RadiusSyncService(prisma);
        await syncService.syncSingleCustomer(customerId);

        console.log(`[RADIUS Hook] Customer created and synced: ${customerId}`);
        return { success: true };
    } catch (error) {
        console.error('[RADIUS Hook] Error in afterCustomerCreate:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
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
    prisma: PrismaClient,
    customerId: string,
    changes: CustomerChange
): Promise<SyncResult> {
    try {
        const syncService = new RadiusSyncService(prisma);

        // Handle status change specifically
        if (changes.statusChanged && changes.newStatus) {
            await syncService.handleStatusChange(customerId, changes.newStatus);
            console.log(
                `[RADIUS Hook] Customer status changed: ${customerId} → ${changes.newStatus}`
            );
        } else {
            // For other changes, do full sync
            await syncService.syncSingleCustomer(customerId);
            console.log(`[RADIUS Hook] Customer updated and synced: ${customerId}`);
        }

        return { success: true };
    } catch (error) {
        console.error('[RADIUS Hook] Error in afterCustomerUpdate:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Hook: Before customer deleted
 * Removes customer from RADIUS before deleting from database
 */
export async function beforeCustomerDelete(
    prisma: PrismaClient,
    username: string
): Promise<SyncResult> {
    try {
        const syncService = new RadiusSyncService(prisma);
        const radiusRepo = syncService['radiusRepo']; // Access private field hack

        await radiusRepo.deleteRadiusUser(username);
        console.log(`[RADIUS Hook] Customer removed from RADIUS: ${username}`);

        return { success: true };
    } catch (error) {
        console.error('[RADIUS Hook] Error in beforeCustomerDelete:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Helper: Log sync result
 */
export function logSyncResult(
    operation: string,
    customerId: string,
    result: SyncResult
): void {
    if (result.success) {
        console.log(`[RADIUS Sync] ${operation} - Success: ${customerId}`);
    } else {
        console.error(
            `[RADIUS Sync] ${operation} - Failed: ${customerId}`,
            result.error
        );
    }
}

/**
 * Helper: Determine if sync is needed
 * Skip sync for test/demo accounts or specific conditions
 */
export function shouldSync(username: string, status?: Status): boolean {
    // Skip sync for demo accounts
    if (username.startsWith('demo_') || username.startsWith('test_')) {
        return false;
    }

    // Add other conditions as needed
    return true;
}
