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
} from './IRadiusRepository';

export class RadiusRepository implements IRadiusRepository {
    constructor(private prisma: PrismaClient) { }

    /**
     * Create RADIUS user with authentication credentials
     */
    async createRadiusUser(data: IRadiusUser): Promise<void> {
        // Create authentication entry in radcheck
        await this.prisma.radCheck.create({
            data: {
                username: data.username,
                attribute: 'Cleartext-Password',
                op: ':=',
                value: data.password,
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
        await this.prisma.radCheck.updateMany({
            where: {
                username,
                attribute: 'Cleartext-Password',
            },
            data: {
                value: password,
            },
        });
    }

    /**
     * Delete RADIUS user and all related records
     */
    async deleteRadiusUser(username: string): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.radCheck.deleteMany({ where: { username } }),
            this.prisma.radReply.deleteMany({ where: { username } }),
            this.prisma.radUserGroup.deleteMany({ where: { username } }),
        ]);
    }

    /**
     * Check if user exists in RADIUS
     */
    async userExists(username: string): Promise<boolean> {
        const count = await this.prisma.radCheck.count({
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
        await this.prisma.radReply.deleteMany({
            where: {
                username,
                attribute: 'Mikrotik-Rate-Limit',
            },
        });

        // Create new bandwidth entry
        await this.prisma.radReply.create({
            data: {
                username,
                attribute: 'Mikrotik-Rate-Limit',
                op: ':=',
                value: rateLimit,
            },
        });
    }

    /**
     * Get user bandwidth settings
     */
    async getUserBandwidth(username: string): Promise<IRadiusBandwidth | null> {
        const reply = await this.prisma.radReply.findFirst({
            where: {
                username,
                attribute: 'Mikrotik-Rate-Limit',
            },
        });

        if (!reply) return null;

        // Parse "upload/download" format
        const [upload, download] = reply.value.split('/').map(Number);
        return {
            uploadMbps: upload / 1000000,
            downloadMbps: download / 1000000,
        };
    }

    /**
     * Assign user to a group
     */
    async assignUserToGroup(username: string, groupname: string, priority = 0): Promise<void> {
        await this.prisma.radUserGroup.upsert({
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
            },
            update: {
                priority,
            },
        });
    }

    /**
     * Remove user from group
     */
    async removeUserFromGroup(username: string, groupname: string): Promise<void> {
        await this.prisma.radUserGroup.delete({
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
        const groups = await this.prisma.radUserGroup.findMany({
            where: { username },
            orderBy: { priority: 'asc' },
        });
        return groups.map((g) => g.groupname);
    }

    /**
     * Get active sessions (acctStopTime is null)
     */
    async getActiveSessions(username?: string): Promise<IRadiusSession[]> {
        const sessions = await this.prisma.radAcct.findMany({
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
        const sessions = await this.prisma.radAcct.findMany({
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

                const value = parseInt(match[1]);
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
}

export default RadiusRepository;
