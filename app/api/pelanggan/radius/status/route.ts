/**
 * Customer RADIUS Session Status API
 * GET /api/pelanggan/radius/status
 * 
 * Returns current session status for logged-in customer
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

        // Get username from idPelanggan or pppUsername
        const username = dbPelanggan.pppUsername || dbPelanggan.idPelanggan;

        // Get current active session
        const activeSession = await prisma.radAcct.findFirst({
            where: {
                username,
                acctStopTime: null,
            },
            orderBy: {
                acctStartTime: 'desc',
            },
        });

        if (!activeSession) {
            return NextResponse.json({
                isOnline: false,
                username,
                message: 'No active session',
            });
        }

        // Calculate uptime
        const now = new Date();
        const startTime = activeSession.acctStartTime || now;
        const uptimeSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const uptimeHours = Math.round((uptimeSeconds / 3600) * 100) / 100;

        // Format data usage
        const downloadMB = activeSession.acctOutputOctets
            ? Math.round((Number(activeSession.acctOutputOctets) / 1048576) * 100) / 100
            : 0;
        const uploadMB = activeSession.acctInputOctets
            ? Math.round((Number(activeSession.acctInputOctets) / 1048576) * 100) / 100
            : 0;

        return NextResponse.json({
            isOnline: true,
            username,
            ipAddress: activeSession.framedIpAddress,
            nasIpAddress: activeSession.nasIpAddress,
            sessionId: activeSession.acctSessionId,
            startTime: activeSession.acctStartTime?.toISOString(),
            uptimeSeconds,
            uptimeHours,
            downloadMB,
            uploadMB,
        });
    } catch (error) {
        console.error('Customer RADIUS status error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch session status',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
