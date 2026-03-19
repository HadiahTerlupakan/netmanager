import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prisma } from '@/lib/prisma';
import { apiError, ErrorCodes } from '@/lib/api-response'

/**
 * GET /api/mobile/departments
 * Get list of departments for work order request picker
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const { tenantId } = authResult;

        // Fetch departments enabled for mobile WO request
        const departments = await prisma.departments.findMany({
            where: {
                showInMobileWO: true, // Only show departments enabled for mobile WO
                tenantId
            },
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
        return apiError('Gagal mengambil daftar departemen', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }
}
