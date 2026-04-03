/**
 * RADIUS Sync Service
 * 
 * High-level service for syncing Pelanggan data to RADIUS tables or MikroTik.
 * Handles status changes, bandwidth updates, and bulk operations.
 * 
 * Mode Koneksi:
 * - RADIUS: Pelanggan auth via FreeRADIUS
 * - MIKROTIK_API: Pelanggan auth via PPP Secret di MikroTik langsung
 */

import { Status } from '@prisma/client';
import { RadiusRepository } from '../repositories/RadiusRepository';
import { MikroTikPPPSecretService } from './MikroTikPPPSecretService';
import { NetworkRepository } from '../repositories/NetworkRepository';
import { prismaRadius } from '@/lib/prisma-radius';

export type ConnectionMode = 'RADIUS' | 'MIKROTIK_API';

export class RadiusSyncService {
    private radiusRepo: RadiusRepository;
    private pppSecretService: MikroTikPPPSecretService;
    private networkRepo: NetworkRepository;

    constructor(radiusClient?: typeof prismaRadius) {
        this.radiusRepo = new RadiusRepository(undefined, radiusClient);
        this.pppSecretService = new MikroTikPPPSecretService();
        this.networkRepo = new NetworkRepository();
    }

    /**
     * Get connection mode from settings
     * Default: RADIUS (backward compatible)
     */
    async getConnectionMode(): Promise<ConnectionMode> {
        try {
            const setting = await this.networkRepo.findSettingByKey('PPP_CONNECTION_MODE');
            if (setting?.value === 'MIKROTIK_API') {
                return 'MIKROTIK_API';
            }
        } catch (_error) {
            console.warn('[RadiusSyncService] Could not read connection mode, defaulting to RADIUS');
        }
        return 'RADIUS';
    }

    /**
     * Sync single customer to RADIUS or MikroTik
     */
    async syncSingleCustomer(pelangganId: string): Promise<void> {
        const mode = await this.getConnectionMode();
        
        if (mode === 'MIKROTIK_API') {
            await this.pppSecretService.syncNewCustomer(pelangganId);
        } else {
            await this.radiusRepo.syncPelangganToRadius(pelangganId);
        }
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
     */
    async handleStatusChange(pelangganId: string, newStatus: Status): Promise<void> {
        const pelanggan = await this.networkRepo.findPelangganBasic(pelangganId);

        if (!pelanggan) {
            throw new Error(`Pelanggan ${pelangganId} not found`);
        }

        const mode = await this.getConnectionMode();

        if (mode === 'MIKROTIK_API') {
            if (newStatus === 'AKTIF') {
                await this.pppSecretService.syncNewCustomer(pelangganId);
                await this.pppSecretService.unIsolateCustomer(pelangganId);
            } else if (newStatus === 'ISOLIR' || newStatus === 'NONAKTIF') {
                await this.pppSecretService.isolateCustomer(pelangganId);
            } else if (newStatus === 'DISMANTLE') {
                await this.pppSecretService.dismantleCustomer(pelangganId);
            } else {
                await this.pppSecretService.isolateCustomer(pelangganId);
            }
        } else {
            await this.radiusRepo.syncPelangganToRadius(pelangganId);

            if (newStatus === 'AKTIF') {
                await this.pppSecretService.unIsolateCustomer(pelangganId);
            } else if (newStatus === 'DISMANTLE') {
                await this.pppSecretService.dismantleCustomer(pelangganId);
            } else {
                await this.pppSecretService.isolateCustomer(pelangganId);
            }
        }
    }

    /**
     * Update customer bandwidth
     */
    async updateCustomerBandwidth(pelangganId: string): Promise<void> {
        await this.syncSingleCustomer(pelangganId);
    }

    /**
     * Get active sessions for customer
     */
    async getCustomerActiveSessions(username: string, tenantId: string) {
        return await this.radiusRepo.getActiveSessions(tenantId, username);
    }

    /**
     * Get accounting statistics for customer
     */
    async getCustomerAccountingStats(
        username: string,
        tenantId: string,
        startDate?: Date,
        endDate?: Date
    ) {
        return await this.radiusRepo.getAccountingStats(username, tenantId, startDate, endDate);
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
        const pelanggan = await this.networkRepo.findPelangganBasic(pelangganId);

        if (!pelanggan || !pelanggan.tenantId) {
            throw new Error(`Pelanggan ${pelangganId} not found or missing tenantId`);
        }

        const existsInRadius = await this.radiusRepo.userExists(pelanggan.username, pelanggan.tenantId);
        const shouldExist = pelanggan.status === 'AKTIF';

        return {
            synced: existsInRadius === shouldExist,
            username: pelanggan.username,
            status: pelanggan.status as Status,
            existsInRadius,
        };
    }
}

export default RadiusSyncService;
