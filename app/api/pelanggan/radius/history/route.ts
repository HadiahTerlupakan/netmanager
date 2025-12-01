/**
 * Customer RADIUS Session History API
 * GET /api/pelanggan/radius/history
 * 
 * Returns session history for logged-in customer with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        // Get customer token and data from headers
        const token = req.headers.get('x-pelanggan-token');
        const pelangganData = req.headers.get('x-pelanggan-data');

        if (!token || !pelangganData) {
            return NextResponse.json(
                { error: 'Unauthorized - No token provided' },
                { status: 401 }
            );
        }

        // Parse customer data from header
        let pelanggan;
        try {
            pelanggan = JSON.parse(pelangganData);
        } catch (e) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid token' },
                { status: 401 }
            );
        }

        // Verify customer is active
        const dbPelanggan = await prisma.pelanggan.findUnique({
            where: { id: pelanggan.id },
            select: { status: true, pppUsername: true, idPelanggan: true },
        });

        if (!dbPelanggan || dbPelanggan.status !== 'AKTIF') {
            return NextResponse.json(
                { error: 'Unauthorized - Customer not active' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        // Get username
        const username = dbPelanggan.pppUsername || dbPelanggan.idPelanggan;

        // Get total count
        const total = await prisma.radAcct.count({
            where: { username },
        });

        // Get sessions with pagination
        const sessions = await prisma.radAcct.findMany({
            where: { username },
            orderBy: {
                acctStartTime: 'desc',
            },
            skip,
            take: limit,
        });

        // Transform sessions
        const transformedSessions = sessions.map((session) => {
            const downloadMB = session.acctOutputOctets
                ? Math.round((Number(session.acctOutputOctets) / 1048576) * 100) / 100
                : 0;
            const uploadMB = session.acctInputOctets
                ? Math.round((Number(session.acctInputOctets) / 1048576) * 100) / 100
                : 0;
            const durationSeconds = session.acctSessionTime
                ? Number(session.acctSessionTime)
                : 0;
            const durationHours = Math.round((durationSeconds / 3600) * 100) / 100;

            return {
                sessionId: session.acctSessionId,
                startTime: session.acctStartTime?.toISOString(),
                stopTime: session.acctStopTime?.toISOString(),
                durationSeconds,
                durationHours,
                downloadMB,
                uploadMB,
                totalMB: Math.round((downloadMB + uploadMB) * 100) / 100,
                ipAddress: session.framedIpAddress,
                isActive: session.acctStopTime === null,
            };
        });

        return NextResponse.json({
            username,
            sessions: transformedSessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Customer RADIUS history error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch session history',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
