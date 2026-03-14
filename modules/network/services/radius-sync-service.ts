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
export type ConnectionMode = 'RADIUS' | 'MIKROTIK_API';

export class RadiusSyncService {
    private radiusRepo: RadiusRepository;
    private pppSecretService: MikroTikPPPSecretService;

    constructor(private prisma: PrismaInstance = defaultPrisma) {
        this.radiusRepo = new RadiusRepository(prisma);
        this.pppSecretService = new MikroTikPPPSecretService(prisma);
    }

    /**
     * Get connection mode from settings
     * Default: RADIUS (backward compatible)
     */
    async getConnectionMode(): Promise<ConnectionMode> {
        try {
            const setting = await this.prisma.settings.findUnique({
                where: { key: 'PPP_CONNECTION_MODE' }
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
     * - ISOLIR/NONAKTIF: Ubah profile ke "expired users" di MikroTik (SAMA untuk kedua mode)
     * - DISMANTLE: Hapus user (RADIUS mode: hapus dari radcheck, API mode: hapus secret)
     */
    async handleStatusChange(pelangganId: string, newStatus: Status): Promise<void> {
        const pelanggan = await this.prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            select: { username: true },
        });

        if (!pelanggan) {
            throw new Error(`Pelanggan ${pelangganId} not found`);
        }

        const mode = await this.getConnectionMode();

        if (newStatus === 'AKTIF') {
            // Re-sync to enable user
            await this.syncSingleCustomer(pelangganId);
            // Kembalikan profile normal di MikroTik
            await this.pppSecretService.unIsolateCustomer(pelangganId);

        } else if (newStatus === 'ISOLIR' || newStatus === 'NONAKTIF') {
            // Isolir: Ubah profile ke "expired users" di MikroTik
            // SAMA untuk kedua mode - isolir selalu via MikroTik
            await this.pppSecretService.isolateCustomer(pelangganId);

        } else if (newStatus === 'DISMANTLE') {
            // Dismantle: Hapus user sepenuhnya
            if (mode === 'MIKROTIK_API') {
                // Hapus secret dari MikroTik
                await this.pppSecretService.dismantleCustomer(pelangganId);
            } else {
                // Hapus dari RADIUS + hapus secret di MikroTik jika ada
                await this.radiusRepo.deleteRadiusUser(pelanggan.username);
                await this.pppSecretService.dismantleCustomer(pelangganId);
            }

        } else {
            // MAINTENANCE atau status lainnya - isolir
            await this.pppSecretService.isolateCustomer(pelangganId);
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
