import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/mobile/departments
 * Get list of departments for work order request picker
 */
export async function GET(request: NextRequest) {
    try {
        // Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Fetch departments
        const departments = await prisma.departments.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: 'asc',
            },
        });

        return NextResponse.json({
            success: true,
            data: departments,
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch departments' },
            { status: 500 }
        );
    }
}
