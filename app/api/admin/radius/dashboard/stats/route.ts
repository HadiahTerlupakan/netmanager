/**
 * RADIUS Dashboard Statistics API
 * GET /api/admin/radius/dashboard/stats
 * 
 * Returns overall statistics for the dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        // Get total users in RADIUS
        const totalUsers = await prisma.radCheck.count({
            where: {
                attribute: 'Cleartext-Password',
            },
        });

        // Get unique usernames (since one user might have multiple radcheck entries)
        const uniqueUsers = await prisma.radCheck.groupBy({
            by: ['username'],
            where: {
                attribute: 'Cleartext-Password',
            },
        });

        // Get online users (active sessions)
        const onlineSessions = await prisma.radAcct.findMany({
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

        const todaySessions = await prisma.radAcct.findMany({
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
        // For now, return mock data
        const lastSyncTime = new Date().toISOString();
        const lastSyncStats = {
            created: 0,
            updated: 0,
            deleted: 0,
        };

        return NextResponse.json({
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
        });
    } catch (error) {
        console.error('RADIUS dashboard stats error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch dashboard statistics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
