import { NextRequest, NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { apiError, ErrorCodes } from '@/lib/api-response'

export async function GET(req: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const payload = authResult
        const tenantId = payload.tenantId as string

        // Check Permission
        const permissions = payload.permissions || []
        if (!permissions.includes('m_salary:read')) {
            return apiError('Akses ditolak: Memerlukan izin m_salary:read', ErrorCodes.FORBIDDEN, { status: 403 })
        }

        const salaries = await prisma.salary.findMany({
            where: {
                userId: payload.id as string,
                status: 'PAID' // Only show paid salaries
            , tenantId },
            select: {
                id: true,
                month: true,
                year: true,
                status: true,
                netSalary: true,
                paidAt: true
            },
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ]
        })

        return NextResponse.json({
            data: salaries.map(s => ({
                id: s.id,
                period: `${new Date(s.year, s.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
                netSalary: s.netSalary,
                paidAt: s.paidAt,
                month: s.month,
                year: s.year
            }))
        })
    } catch (error) {
        console.error('Error fetching mobile salaries:', error)
        return apiError('Gagal mengambil data gaji', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
