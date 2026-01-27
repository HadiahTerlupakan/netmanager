
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const salary = await prisma.salary.findUnique({
            where: {
                id,
                userId: session.user.id, // Security check: Must belong to user
                status: 'PAID' // Security check: Must be PAID
            },
            include: {
                details: {
                    orderBy: { type: 'asc' }
                }
            }
        })

        if (!salary) {
            return NextResponse.json({ error: 'Salary not found or not available' }, { status: 404 })
        }

        const earnings = salary.details.filter(d => d.type === 'EARNING')
        const deductions = salary.details.filter(d => d.type === 'DEDUCTION')

        return NextResponse.json({
            data: {
                id: salary.id,
                period: `${new Date(salary.year, salary.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
                basicSalary: salary.basicSalary,
                totalEarnings: salary.totalEarnings,
                totalDeductions: salary.totalDeductions,
                netSalary: salary.netSalary,
                paidAt: salary.paidAt,
                earnings: earnings.map(e => ({
                    id: e.id,
                    name: e.name,
                    amount: e.amount,
                    quantity: e.quantity,
                    rate: e.rate
                })),
                deductions: deductions.map(d => ({
                    id: d.id,
                    name: d.name,
                    amount: d.amount,
                    notes: d.notes
                }))
            }
        })
    } catch (error) {
        console.error('Error fetching mobile salary detail:', error)
        return NextResponse.json(
            { error: 'Failed to fetch salary detail' },
            { status: 500 }
        )
    }
}
