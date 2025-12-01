/**
 * Customer RADIUS Usage Statistics API
 * GET /api/pelanggan/radius/usage
 * 
 * Returns usage statistics for logged-in customer
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
            select: { status: true, username: true, idPelanggan: true },
        });

        if (!dbPelanggan || dbPelanggan.status !== 'AKTIF') {
            return NextResponse.json(
                { error: 'Unauthorized - Customer not active' },
                { status: 401 }
            );
        }

        // Get username
        const username = dbPelanggan.username || dbPelanggan.idPelanggan;

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get this month's date range
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        // Get today's sessions
        const todaySessions = await prisma.radAcct.findMany({
            where: {
                username,
                acctStartTime: {
                    gte: today,
                    lt: tomorrow,
                },
            },
        });

        // Get this month's sessions
        const thisMonthSessions = await prisma.radAcct.findMany({
            where: {
                username,
                acctStartTime: {
                    gte: thisMonthStart,
                    lt: nextMonthStart,
                },
            },
        });

        // Calculate today's usage
        let todayDownloadBytes = BigInt(0);
        let todayUploadBytes = BigInt(0);
        let todaySessionCount = 0;
        let todayTotalSeconds = 0;

        for (const session of todaySessions) {
            if (session.acctOutputOctets) todayDownloadBytes += session.acctOutputOctets;
            if (session.acctInputOctets) todayUploadBytes += session.acctInputOctets;
            if (session.acctSessionTime) todayTotalSeconds += Number(session.acctSessionTime);
            todaySessionCount++;
        }

        // Calculate this month's usage
        let monthDownloadBytes = BigInt(0);
        let monthUploadBytes = BigInt(0);
        let monthSessionCount = 0;
        let monthTotalSeconds = 0;

        for (const session of thisMonthSessions) {
            if (session.acctOutputOctets) monthDownloadBytes += session.acctOutputOctets;
            if (session.acctInputOctets) monthUploadBytes += session.acctInputOctets;
            if (session.acctSessionTime) monthTotalSeconds += Number(session.acctSessionTime);
            monthSessionCount++;
        }

        // Convert to GB
        const todayDownloadGB = Number(todayDownloadBytes) / 1073741824;
        const todayUploadGB = Number(todayUploadBytes) / 1073741824;
        const monthDownloadGB = Number(monthDownloadBytes) / 1073741824;
        const monthUploadGB = Number(monthUploadBytes) / 1073741824;

        // Convert seconds to hours
        const todayHours = todayTotalSeconds / 3600;
        const monthHours = monthTotalSeconds / 3600;

        return NextResponse.json({
            username,
            today: {
                downloadGB: Math.round(todayDownloadGB * 100) / 100,
                uploadGB: Math.round(todayUploadGB * 100) / 100,
                totalGB: Math.round((todayDownloadGB + todayUploadGB) * 100) / 100,
                sessionCount: todaySessionCount,
                totalHours: Math.round(todayHours * 100) / 100,
            },
            thisMonth: {
                downloadGB: Math.round(monthDownloadGB * 100) / 100,
                uploadGB: Math.round(monthUploadGB * 100) / 100,
                totalGB: Math.round((monthDownloadGB + monthUploadGB) * 100) / 100,
                sessionCount: monthSessionCount,
                totalHours: Math.round(monthHours * 100) / 100,
            },
        });
    } catch (error) {
        console.error('Customer RADIUS usage error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch usage statistics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
