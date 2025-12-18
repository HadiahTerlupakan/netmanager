/**
 * RADIUS Sync Service
 * 
 * High-level service for syncing Pelanggan data to RADIUS tables.
 * Handles status changes, bandwidth updates, and bulk operations.
 */

import { PrismaClient, Status } from '@prisma/client';
import { RadiusRepository } from '../repositories/RadiusRepository';

export class RadiusSyncService {
    private radiusRepo: RadiusRepository;

    constructor(private prisma: PrismaClient) {
        this.radiusRepo = new RadiusRepository(prisma);
    }

    /**
     * Sync single customer to RADIUS
     */
    async syncSingleCustomer(pelangganId: string): Promise<void> {
        await this.radiusRepo.syncPelangganToRadius(pelangganId);
    }

    /**
     * Sync all active customers to RADIUS
     */
    async syncAllActiveCustomers(): Promise<{
        created: number;
        updated: number;
        deleted: number;
    }> {
        return await this.radiusRepo.syncAllActiveCustomers();
    }

    /**
     * Handle customer status change
     * Automatically enables/disables RADIUS user based on status
     */
    async handleStatusChange(pelangganId: string, newStatus: Status): Promise<void> {
        const pelanggan = await this.prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            select: { username: true },
        });

        if (!pelanggan) {
            throw new Error(`Pelanggan ${pelangganId} not found`);
        }

        if (newStatus === 'AKTIF') {
            // Re-sync to enable user
            await this.syncSingleCustomer(pelangganId);
        } else {
            // Disable by deleting from RADIUS
            await this.radiusRepo.deleteRadiusUser(pelanggan.username);
        }
    }

    /**
     * Update customer bandwidth
     * Called when package is changed
     */
    async updateCustomerBandwidth(pelangganId: string): Promise<void> {
        await this.syncSingleCustomer(pelangganId);
    }

    /**
     * Get active sessions for customer
     */
    async getCustomerActiveSessions(username: string) {
        return await this.radiusRepo.getActiveSessions(username);
    }

    /**
     * Get accounting statistics for customer
     */
    async getCustomerAccountingStats(
        username: string,
        startDate?: Date,
        endDate?: Date
    ) {
        return await this.radiusRepo.getAccountingStats(username, startDate, endDate);
    }

    /**
     * Verify RADIUS sync status for customer
     */
    async verifyCustomerSync(pelangganId: string): Promise<{
        synced: boolean;
        username: string;
        status: Status;
        existsInRadius: boolean;
    }> {
        const pelanggan = await this.prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            select: {
                username: true,
                status: true,
            },
        });

        if (!pelanggan) {
            throw new Error(`Pelanggan ${pelangganId} not found`);
        }

        const existsInRadius = await this.radiusRepo.userExists(pelanggan.username);
        const shouldExist = pelanggan.status === 'AKTIF';

        return {
            synced: existsInRadius === shouldExist,
            username: pelanggan.username,
            status: pelanggan.status,
            existsInRadius,
        };
    }
}

export default RadiusSyncService;
