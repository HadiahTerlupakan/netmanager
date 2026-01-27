import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get user salary details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: userId } = await params

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                employeeType: true, // KARYAWAN / MITRA
                
                // Salary Config
                basicSalary: true,
                overtimeRateNormal: true,
                overtimeCalcTypeNormal: true,
                overtimeRateHoliday: true,
                overtimeCalcTypeHoliday: true,
                overtimeRateNational: true,
                overtimeCalcTypeNational: true,
                woIncentiveRate: true,
                lateDeductionRate: true,
                absentDeductionRate: true,
                
                // Relations
                departments: {
                    select: { name: true }
                },
                userSalaryComponents: {
                    where: { isActive: true },
                    include: {
                        component: true
                    },
                    orderBy: { component: { type: 'asc' } } // Earnings first, then deductions
                }
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({ user })
    } catch (error) {
        console.error('[API] Error fetching salary user detail:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT - Update user salary config
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const {
            basicSalary,
            employeeType,
            overtimeRateNormal, overtimeCalcTypeNormal,
            overtimeRateHoliday, overtimeCalcTypeHoliday,
            overtimeRateNational, overtimeCalcTypeNational,
            woIncentiveRate,
            lateDeductionRate,
            absentDeductionRate
        } = body

        await prisma.user.update({
            where: { id },
            data: {
                employeeType,
                basicSalary: basicSalary ? parseFloat(basicSalary) : null,
                overtimeRateNormal: overtimeRateNormal ? parseFloat(overtimeRateNormal) : null,
                overtimeCalcTypeNormal,
                overtimeRateHoliday: overtimeRateHoliday ? parseFloat(overtimeRateHoliday) : null,
                overtimeCalcTypeHoliday,
                overtimeRateNational: overtimeRateNational ? parseFloat(overtimeRateNational) : null,
                overtimeCalcTypeNational,
                woIncentiveRate: woIncentiveRate ? parseFloat(woIncentiveRate) : null,
                lateDeductionRate: lateDeductionRate ? parseFloat(lateDeductionRate) : null,
                absentDeductionRate: absentDeductionRate ? parseFloat(absentDeductionRate) : null,
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error updating user salary config:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE - Remove user from salary list
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        await prisma.user.update({
            where: { id },
            data: { basicSalary: null }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error removing salary user:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
