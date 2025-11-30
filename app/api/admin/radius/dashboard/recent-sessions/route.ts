/**
 * RADIUS Recent Sessions API
 * GET /api/admin/radius/dashboard/recent-sessions
 * 
 * Returns recent/active sessions with pagination
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

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const status = searchParams.get('status') || 'active'; // active | all

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};
        if (status === 'active') {
            where.acctStopTime = null;
        }

        // Get total count
        const total = await prisma.radAcct.count({ where });

        // Get sessions
        const sessions = await prisma.radAcct.findMany({
            where,
            orderBy: {
                acctStartTime: 'desc',
            },
            skip,
            take: limit,
        });

        // Transform sessions to include calculated fields
        const now = new Date();
        const transformedSessions = sessions.map((session) => {
            const startTime = session.acctStartTime || new Date();
            const isOnline = session.acctStopTime === null;

            // Calculate uptime
            let uptimeSeconds = 0;
            if (isOnline) {
                uptimeSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
            } else if (session.acctSessionTime) {
                uptimeSeconds = Number(session.acctSessionTime);
            }

            const uptimeHours = Math.round((uptimeSeconds / 3600) * 100) / 100;

            // Calculate data usage in MB
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

        return NextResponse.json({
            sessions: transformedSessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('RADIUS recent sessions error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch sessions',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
