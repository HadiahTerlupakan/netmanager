import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const payload = await verifyMobileToken(token)

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        // Check Permission
        const permissions = payload.permissions || []
        if (!permissions.includes('m_salary:read')) {
            return NextResponse.json({ error: 'Dilarang: Memerlukan izin m_salary:read' }, { status: 403 })
        }

        const { id } = await params
        const salary = await prisma.salary.findUnique({
            where: {
                id,
                userId: payload.id as string, // Security check: Must belong to user
                status: 'PAID' // Security check: Must be PAID
            },
            include: {
                details: {
                    orderBy: { type: 'asc' }
                }
            }
        })

        if (!salary) {
            return NextResponse.json({ error: 'Gaji tidak ditemukan atau tidak tersedia' }, { status: 404 })
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
            { error: 'Gagal mengambil detail gaji' },
            { status: 500 }
        )
    }
}
