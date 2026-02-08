import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const payload = await verifyMobileToken(token)

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 })
        }

        // Check Permission
        const permissions = payload.permissions || []
        if (!permissions.includes('m_salary:read')) {
            return NextResponse.json({ error: 'Forbidden: Requires m_salary:read permission' }, { status: 403 })
        }

        const salaries = await prisma.salary.findMany({
            where: {
                userId: payload.id as string,
                status: 'PAID' // Only show paid salaries
            },
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
        return NextResponse.json(
            { error: 'Failed to fetch salaries' },
            { status: 500 }
        )
    }
}
