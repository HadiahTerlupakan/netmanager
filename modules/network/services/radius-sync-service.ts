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
import { prisma as defaultPrisma } from '@/lib/prisma';

type PrismaInstance = typeof defaultPrisma;

// Connection mode types
import { prismaRadius } from '@/lib/prisma-radius';

export type ConnectionMode = 'RADIUS' | 'MIKROTIK_API';

export class RadiusSyncService {
    private radiusRepo: RadiusRepository;
    private pppSecretService: MikroTikPPPSecretService;

    constructor(private prisma: PrismaInstance = defaultPrisma, radiusClient?: typeof prismaRadius) {
        this.radiusRepo = new RadiusRepository(prisma, radiusClient);
        this.pppSecretService = new MikroTikPPPSecretService(prisma);
    }

    /**
     * Get connection mode from settings
     * Default: RADIUS (backward compatible)
     */
    async getConnectionMode(): Promise<ConnectionMode> {
        try {
            const setting = await this.prisma.settings.findFirst({ where: { key: 'PPP_CONNECTION_MODE' }
            });
            if (setting?.value === 'MIKROTIK_API') {
                return 'MIKROTIK_API';
            }
        } catch (_error) {
            // Settings table might not exist or other error, default to RADIUS
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
     * - AKTIF: Sync user (RADIUS mode: sync to radcheck, API mode: create secret)
     * - ISOLIR/NONAKTIF: Ubah profile ke "expired users" di MikroTik (API mode) atau pindah ke grup ISOLIR (RADIUS mode)
     * - DISMANTLE: Hapus user sepenuhnya
     */
    async handleStatusChange(pelangganId: string, newStatus: Status): Promise<void> {
        const pelanggan = await this.prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            select: { username: true, status: true },
        });

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
            // RADIUS Mode
            // Update RADIUS tables (handles AKTIF, ISOLIR, NONAKTIF, DISMANTLE)
            await this.radiusRepo.syncPelangganToRadius(pelangganId);

            // Also try to update MikroTik profile if secret exists (for hybrid migration)
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
     * Called when package is changed
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
        const pelanggan = await this.prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            select: {
                username: true,
                status: true,
                tenantId: true,
            },
        });

        if (!pelanggan || !pelanggan.tenantId) {
            throw new Error(`Pelanggan ${pelangganId} not found or missing tenantId`);
        }

        const existsInRadius = await this.radiusRepo.userExists(pelanggan.username, pelanggan.tenantId);
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
