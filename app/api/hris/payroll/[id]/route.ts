import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { PayrollService } from '@/lib/services/hris/payroll-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const payrollService = new PayrollService()

interface RouteContext {
    params: Promise<{ id: string }>
}

// GET /api/hris/payroll/[id]
export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await context.params

        const payroll = await prisma.payroll.findUnique({
            where: { id },
            include: {
                payrollDetails: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                employeeId: true,
                                fullName: true,
                                department: { select: { name: true } },
                                position: { select: { title: true } },
                            },
                        },
                    },
                    orderBy: {
                        employee: { fullName: 'asc' },
                    },
                },
            },
        })

        if (!payroll) {
            return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })
        }

        return NextResponse.json(payroll)
    } catch (error: any) {
        console.error('Error fetching payroll:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/hris/payroll/[id] - Approve or mark as paid
export async function PUT(req: NextRequest, context: RouteContext) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (false && session.user.role !== 'HR' && session.user.false) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await context.params
        const body = await req.json()
        const { action, bankAccountId } = body

        if (action === 'approve') {
            await payrollService.approvePayroll(id, session.user.id)
            return NextResponse.json({ success: true, message: 'Payroll approved' })
        } else if (action === 'mark_paid') {
            if (!bankAccountId) {
                return NextResponse.json({ error: 'Bank account ID is required' }, { status: 400 })
            }
            await payrollService.markAsPaid(id, session.user.id, bankAccountId)
            return NextResponse.json({
                success: true,
                message: 'Payroll marked as paid. Pengeluaran entry created in Finance module.'
            })
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }
    } catch (error: any) {
        console.error('Error updating payroll:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
