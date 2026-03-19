import { NextRequest, NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { apiError, ErrorCodes } from '@/lib/api-response'

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
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
            return apiError('Dilarang: Memerlukan izin m_salary:read', ErrorCodes.FORBIDDEN, { status: 403 })
        }

        const { id } = await params
        const salary = await prisma.salary.findFirst({
            where: {
                id,
                userId: payload.id as string, // Security check: Must belong to user
                status: 'PAID' // Security check: Must be PAID
            , tenantId },
            include: {
                details: {
                    orderBy: { type: 'asc' }
                }
            }
        })

        if (!salary) {
            return apiError('Gaji tidak ditemukan atau tidak tersedia', ErrorCodes.NOT_FOUND, { status: 404 })
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
        return apiError('Gagal mengambil detail gaji', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
