/**
 * RADIUS Repository Implementation
 * 
 * Implements FreeRADIUS database operations using Prisma ORM.
 */

import { PrismaClient } from '@prisma/client';
import type {
    IRadiusRepository,
    IRadiusUser,
    IRadiusBandwidth,
    IRadiusSession,
    IRadiusAccountingStats,
    INas,
    IRadIpPool,
    IDashboardStats,
    IRadiusSessionView,
} from './IRadiusRepository';
import { Prisma } from '@prisma/client';

export class RadiusRepository implements IRadiusRepository {
    constructor(private prisma: PrismaClient) { }

    /**
     * Create RADIUS user with authentication credentials
     */
    async createRadiusUser(data: IRadiusUser): Promise<void> {
        // Create authentication entry in radcheck
        await this.prisma.radcheck.create({
            data: {
                username: data.username,
                attribute: 'Cleartext-Password',
                op: ':=',
                value: data.password,
                updatedAt: new Date(),
            },
        });

        // Assign to group if specified
        if (data.groupname) {
            await this.assignUserToGroup(data.username, data.groupname);
        }
    }

    /**
     * Update user password
     */
    async updateRadiusPassword(username: string, password: string): Promise<void> {
        await this.prisma.radcheck.updateMany({
            where: {
                username,
                attribute: 'Cleartext-Password',
            },
            data: {
                value: password,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Delete RADIUS user and all related records
     */
    async deleteRadiusUser(username: string): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.radcheck.deleteMany({ where: { username } }),
            this.prisma.radreply.deleteMany({ where: { username } }),
            this.prisma.radusergroup.deleteMany({ where: { username } }),
        ]);
    }

    /**
     * Check if user exists in RADIUS
     */
    async userExists(username: string): Promise<boolean> {
        const count = await this.prisma.radcheck.count({
            where: {
                username,
                attribute: 'Cleartext-Password',
            },
        });
        return count > 0;
    }

    /**
     * Set user bandwidth using Mikrotik-Rate-Limit attribute
     * Format: "upload/download" in bits per second
     */
    async setUserBandwidth(username: string, bandwidth: IRadiusBandwidth): Promise<void> {
        const uploadBps = bandwidth.uploadMbps * 1000000;
        const downloadBps = bandwidth.downloadMbps * 1000000;
        const rateLimit = `${uploadBps}/${downloadBps}`;

        // Delete existing bandwidth entries
        await this.prisma.radreply.deleteMany({
            where: {
                username,
                attribute: 'Mikrotik-Rate-Limit',
            },
        });

        // Create new bandwidth entry
        await this.prisma.radreply.create({
            data: {
                username,
                attribute: 'Mikrotik-Rate-Limit',
                op: ':=',
                value: rateLimit,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Get user bandwidth settings
     */
    async getUserBandwidth(username: string): Promise<IRadiusBandwidth | null> {
        const reply = await this.prisma.radreply.findFirst({
            where: {
                username,
                attribute: 'Mikrotik-Rate-Limit',
            },
        });

        if (!reply) return null;

        // Parse "upload/download" format
        const parts = reply.value.split('/').map(Number);
        const upload = parts[0] ?? 0;
        const download = parts[1] ?? 0;

        return {
            uploadMbps: upload / 1000000,
            downloadMbps: download / 1000000,
        };
    }

    /**
     * Assign user to a group
     */
    async assignUserToGroup(username: string, groupname: string, priority = 0): Promise<void> {
        await this.prisma.radusergroup.upsert({
            where: {
                username_groupname: {
                    username,
                    groupname,
                },
            },
            create: {
                username,
                groupname,
                priority,
                updatedAt: new Date(),
            },
            update: {
                priority,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Remove user from group
     */
    async removeUserFromGroup(username: string, groupname: string): Promise<void> {
        await this.prisma.radusergroup.delete({
            where: {
                username_groupname: {
                    username,
                    groupname,
                },
            },
        });
    }

    /**
     * Get all groups assigned to user
     */
    async getUserGroups(username: string): Promise<string[]> {
        const groups = await this.prisma.radusergroup.findMany({
            where: { username },
            orderBy: { priority: 'asc' },
        });
        return groups.map((g) => g.groupname);
    }

    /**
     * Get active sessions (acctStopTime is null)
     */
    async getActiveSessions(username?: string): Promise<IRadiusSession[]> {
        const sessions = await this.prisma.radacct.findMany({
            where: {
                acctStopTime: null,
                ...(username && { username }),
            },
            orderBy: {
                acctStartTime: 'desc',
            },
        });

        return sessions as IRadiusSession[];
    }

    /**
     * Get user sessions within date range
     */
    async getUserSessions(
        username: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<IRadiusSession[]> {
        const sessions = await this.prisma.radacct.findMany({
            where: {
                username,
                ...(startDate && {
                    acctStartTime: {
                        gte: startDate,
                    },
                }),
                ...(endDate && {
                    acctStartTime: {
                        lte: endDate,
                    },
                }),
            },
            orderBy: {
                acctStartTime: 'desc',
            },
        });

        return sessions as IRadiusSession[];
    }

    /**
     * Get accounting statistics for user
     */
    async getAccountingStats(
        username: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<IRadiusAccountingStats> {
        const sessions = await this.getUserSessions(username, startDate, endDate);

        const stats: IRadiusAccountingStats = {
            username,
            totalSessions: sessions.length,
            totalSessionTime: BigInt(0),
            totalInputOctets: BigInt(0),
            totalOutputOctets: BigInt(0),
            activeSessions: 0,
        };

        for (const session of sessions) {
            if (session.acctSessionTime) {
                stats.totalSessionTime += session.acctSessionTime;
            }
            if (session.acctInputOctets) {
                stats.totalInputOctets += session.acctInputOctets;
            }
            if (session.acctOutputOctets) {
                stats.totalOutputOctets += session.acctOutputOctets;
            }
            if (!session.acctStopTime) {
                stats.activeSessions++;
            }
        }

        return stats;
    }

    /**
     * Sync single pelanggan to RADIUS
     */
    async syncPelangganToRadius(pelangganId: string): Promise<void> {
        const pelanggan = await this.prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            include: {
                hargaPaket: {
                    include: {
                        bandwidth: true,
                    },
                },
            },
        });

        if (!pelanggan) {
            throw new Error(`Pelanggan ${pelangganId} not found`);
        }

        const { username, password, status, hargaPaket } = pelanggan;

        // Delete user if not AKTIF
        if (status !== 'AKTIF') {
            await this.deleteRadiusUser(username);
            return;
        }

        // Check if user exists
        const exists = await this.userExists(username);

        if (!exists) {
            // Create new user
            await this.createRadiusUser({
                username,
                password,
                groupname: hargaPaket.name,
            });
        } else {
            // Update password
            await this.updateRadiusPassword(username, password);
        }

        // Set bandwidth if available
        if (hargaPaket.bandwidth) {
            const bandwidth = hargaPaket.bandwidth;

            // Parse bandwidth from MikroTik format (e.g., "10M")
            const parseSpeed = (speed: string): number => {
                const match = speed.match(/^(\d+)([MK])?$/i);
                if (!match) return 0;

                const value = parseInt(match[1] ?? '0');
                const unit = match[2]?.toUpperCase();

                if (unit === 'M') return value;
                if (unit === 'K') return value / 1000;
                return value / 1000000; // Assume Kbps if no unit
            };

            await this.setUserBandwidth(username, {
                uploadMbps: parseSpeed(bandwidth.maxLimitUpload),
                downloadMbps: parseSpeed(bandwidth.maxLimitDownload),
            });
        }

        // Assign to package group
        await this.assignUserToGroup(username, hargaPaket.name);
    }

    /**
     * Sync all active customers to RADIUS
     */
    async syncAllActiveCustomers(): Promise<{ created: number; updated: number; deleted: number }> {
        const pelanggans = await this.prisma.pelanggan.findMany({
            include: {
                hargaPaket: {
                    include: {
                        bandwidth: true,
                    },
                },
            },
        });

        let created = 0;
        let updated = 0;
        let deleted = 0;

        for (const pelanggan of pelanggans) {
            const exists = await this.userExists(pelanggan.username);

            if (pelanggan.status === 'AKTIF') {
                if (exists) {
                    updated++;
                } else {
                    created++;
                }
                await this.syncPelangganToRadius(pelanggan.id);
            } else {
                if (exists) {
                    deleted++;
                    await this.deleteRadiusUser(pelanggan.username);
                }
            }
        }

        return { created, updated, deleted };
    }

    /**
     * Create new NAS (Network Access Server)
     */
    async createNas(nas: INas): Promise<INas> {
        const created = await this.prisma.nas.create({
            data: {
                nasname: nas.nasname,
                shortname: nas.shortname ?? null,
                type: nas.type || 'other',
                ports: nas.ports ?? null,
                secret: nas.secret,
                community: nas.community ?? null,
                description: nas.description ?? null,
                updatedAt: new Date(),
            },
        });

        return {
            id: created.id,
            nasname: created.nasname,
            secret: created.secret,
            ...(created.shortname ? { shortname: created.shortname } : {}),
            ...(created.type ? { type: created.type } : {}),
            ...(created.ports ? { ports: created.ports } : {}),
            ...(created.community ? { community: created.community } : {}),
            ...(created.description ? { description: created.description } : {}),
        };
    }

    /**
     * Update NAS configuration
     */
    async updateNas(id: number, nas: Partial<INas>): Promise<INas> {
        const updated = await this.prisma.nas.update({
            where: { id },
            data: {
                ...(nas.nasname !== undefined ? { nasname: nas.nasname } : {}),
                ...(nas.shortname !== undefined ? { shortname: nas.shortname } : {}),
                ...(nas.type !== undefined ? { type: nas.type } : {}),
                ...(nas.ports !== undefined ? { ports: nas.ports } : {}),
                ...(nas.secret !== undefined ? { secret: nas.secret } : {}),
                ...(nas.community !== undefined ? { community: nas.community } : {}),
                ...(nas.description !== undefined ? { description: nas.description } : {}),
                updatedAt: new Date(),
            },
        });

        return {
            id: updated.id,
            nasname: updated.nasname,
            secret: updated.secret,
            ...(updated.shortname ? { shortname: updated.shortname } : {}),
            ...(updated.type ? { type: updated.type } : {}),
            ...(updated.ports ? { ports: updated.ports } : {}),
            ...(updated.community ? { community: updated.community } : {}),
            ...(updated.description ? { description: updated.description } : {}),
        };
    }

    /**
     * Delete NAS
     */
    async deleteNas(id: number): Promise<void> {
        await this.prisma.nas.delete({
            where: { id },
        });
    }

    /**
     * Get NAS by ID
     */
    async getNasById(id: number): Promise<INas | null> {
        const nas = await this.prisma.nas.findUnique({
            where: { id },
        });

        if (!nas) return null;

        return {
            id: nas.id,
            nasname: nas.nasname,
            secret: nas.secret,
            ...(nas.shortname ? { shortname: nas.shortname } : {}),
            ...(nas.type ? { type: nas.type } : {}),
            ...(nas.ports ? { ports: nas.ports } : {}),
            ...(nas.community ? { community: nas.community } : {}),
            ...(nas.description ? { description: nas.description } : {}),
        };
    }

    /**
     * Get all NAS
     */
    async getAllNas(): Promise<INas[]> {
        const nasList = await this.prisma.nas.findMany({
            orderBy: { nasname: 'asc' },
        });

        return nasList.map(nas => ({
            id: nas.id,
            nasname: nas.nasname,
            secret: nas.secret,
            ...(nas.shortname ? { shortname: nas.shortname } : {}),
            ...(nas.type ? { type: nas.type } : {}),
            ...(nas.ports ? { ports: nas.ports } : {}),
            ...(nas.community ? { community: nas.community } : {}),
            ...(nas.description ? { description: nas.description } : {}),
        }));
    }

    /**
     * Get NAS by IP address
     */
    async getNasByIp(ip: string): Promise<INas | null> {
        const nas = await this.prisma.nas.findUnique({
            where: { nasname: ip },
        });

        if (!nas) return null;

        return {
            id: nas.id,
            nasname: nas.nasname,
            secret: nas.secret,
            ...(nas.shortname ? { shortname: nas.shortname } : {}),
            ...(nas.type ? { type: nas.type } : {}),
            ...(nas.ports ? { ports: nas.ports } : {}),
            ...(nas.community ? { community: nas.community } : {}),
            ...(nas.description ? { description: nas.description } : {}),
        };
    }

    /**
     * Add IP to pool
     */
    async addToIpPool(pool: IRadIpPool): Promise<IRadIpPool> {
        const created = await this.prisma.radippool.create({
            data: {
                pool_name: pool.poolName,
                framedipaddress: pool.framedIpAddress,
                nasipaddress: pool.nasIpAddress ?? null,
                pool_key: pool.poolKey ?? null,
                updatedAt: new Date(),
            },
        });

        return {
            id: created.id,
            poolName: created.pool_name,
            framedIpAddress: created.framedipaddress,
            ...(created.nasipaddress ? { nasIpAddress: created.nasipaddress } : {}),
            ...(created.pool_key ? { poolKey: created.pool_key } : {}),
        };
    }

    /**
     * Remove IP from pool
     */
    async removeFromIpPool(ipAddress: string): Promise<void> {
        await this.prisma.radippool.delete({
            where: { framedipaddress: ipAddress },
        });
    }

    /**
     * Get available IP from pool
     */
    async getIpFromPool(poolName: string, nasIpAddress?: string): Promise<string | null> {
        const availableIp = await this.prisma.radippool.findFirst({
            where: {
                pool_name: poolName,
                nasipaddress: nasIpAddress || null,
                // Find IP that's not currently assigned
            },
        });

        return availableIp?.framedipaddress || null;
    }

    /**
     * Return IP to pool (mark as available)
     */
    async returnIpToPool(ipAddress: string): Promise<void> {
        // In a real implementation, you might clear the poolKey or nasIpAddress
        // to mark the IP as available again
        await this.prisma.radippool.updateMany({
            where: { framedipaddress: ipAddress },
            data: {
                nasipaddress: null,
                pool_key: null,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Get IP pool statistics
     */
    async getIpPoolStats(poolName?: string): Promise<{ total: number; used: number; available: number }> {
        const whereClause = poolName ? { pool_name: poolName } : {};

        const total = await this.prisma.radippool.count({
            where: whereClause,
        });

        const used = await this.prisma.radippool.count({
            where: {
                ...whereClause,
                nasipaddress: { not: null },
            },
        });

        return {
            total,
            used,
            available: total - used,
        };
    }

    /**
     * Get all IP pools
     */
    async getAllIpPools(): Promise<IRadIpPool[]> {
        const pools = await this.prisma.radippool.findMany({
            orderBy: [{ pool_name: 'asc' }, { framedipaddress: 'asc' }],
        });

        return pools.map(pool => ({
            id: pool.id,
            poolName: pool.pool_name,
            framedIpAddress: pool.framedipaddress,
            ...(pool.nasipaddress ? { nasIpAddress: pool.nasipaddress } : {}),
            ...(pool.pool_key ? { poolKey: pool.pool_key } : {}),
        }));

    }
    /**
     * Get dashboard statistics
     */
    async getDashboardStats(): Promise<IDashboardStats> {
        // Get unique usernames (since one user might have multiple radcheck entries)
        const uniqueUsers = await this.prisma.radcheck.groupBy({
            by: ['username'],
            where: {
                attribute: 'Cleartext-Password',
            },
        });

        // Get online users (active sessions)
        const onlineSessions = await this.prisma.radacct.findMany({
            where: {
                acctStopTime: null,
            },
            distinct: ['username'],
        });

        const onlineUsers = onlineSessions.length;
        const offlineUsers = uniqueUsers.length - onlineUsers;

        // Get today's traffic
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaySessions = await this.prisma.radacct.findMany({
            where: {
                acctStartTime: {
                    gte: today,
                },
            },
        });

        let totalDownloadBytes = BigInt(0);
        let totalUploadBytes = BigInt(0);

        for (const session of todaySessions) {
            if (session.acctOutputOctets) {
                totalDownloadBytes += session.acctOutputOctets;
            }
            if (session.acctInputOctets) {
                totalUploadBytes += session.acctInputOctets;
            }
        }

        // Convert to GB
        const downloadGB = Number(totalDownloadBytes) / 1073741824;
        const uploadGB = Number(totalUploadBytes) / 1073741824;

        // TODO: Get last sync info from cache/database
        const lastSyncTime = new Date().toISOString();
        const lastSyncStats = {
            created: 0,
            updated: 0,
            deleted: 0,
        };

        return {
            totalUsers: uniqueUsers.length,
            onlineUsers,
            offlineUsers,
            totalTrafficToday: {
                download: totalDownloadBytes.toString(),
                upload: totalUploadBytes.toString(),
                downloadGB: Math.round(downloadGB * 100) / 100,
                uploadGB: Math.round(uploadGB * 100) / 100,
            },
            lastSyncTime,
            lastSyncStats,
        };
    }

    /**
     * Get recent sessions with pagination
     */
    async getRecentSessions(options: {
        page?: number;
        limit?: number;
        status?: 'active' | 'all'
    } = {}): Promise<{ sessions: IRadiusSessionView[]; total: number }> {
        const { page = 1, limit = 50, status = 'active' } = options;
        const skip = (page - 1) * limit;

        const where: Prisma.RadacctWhereInput = {};
        if (status === 'active') {
            where.acctStopTime = null;
        }

        const total = await this.prisma.radacct.count({ where });

        const sessions = await this.prisma.radacct.findMany({
            where,
            orderBy: {
                acctStartTime: 'desc',
            },
            skip,
            take: limit,
        });

        const now = new Date();
        const transformedSessions = sessions.map((session) => {
            const startTime = session.acctStartTime || new Date();
            const isOnline = session.acctStopTime === null;

            let uptimeSeconds = 0;
            if (isOnline) {
                uptimeSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
            } else if (session.acctSessionTime) {
                uptimeSeconds = Number(session.acctSessionTime);
            }

            const uptimeHours = Math.round((uptimeSeconds / 3600) * 100) / 100;

            const downloadMB = session.acctOutputOctets
                ? Math.round((Number(session.acctOutputOctets) / 1048576) * 100) / 100
                : 0;
            const uploadMB = session.acctInputOctets
                ? Math.round((Number(session.acctInputOctets) / 1048576) * 100) / 100
                : 0;

            return {
                radAcctId: session.radAcctId.toString(),
                username: session.username,
                nasIpAddress: session.nasIpAddress,
                framedIpAddress: session.framedIpAddress,
                acctStartTime: session.acctStartTime?.toISOString() || null,
                acctStopTime: session.acctStopTime?.toISOString() || null,
                acctSessionTime: session.acctSessionTime?.toString() || '0',
                acctInputOctets: session.acctInputOctets?.toString() || '0',
                acctOutputOctets: session.acctOutputOctets?.toString() || '0',
                uptimeSeconds,
                uptimeHours,
                downloadMB,
                uploadMB,
                isOnline,
            };
        });

        return { sessions: transformedSessions, total };
    }
}

export default RadiusRepository;
