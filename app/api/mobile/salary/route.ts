
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const salaries = await prisma.salary.findMany({
            where: {
                userId: session.user.id,
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
