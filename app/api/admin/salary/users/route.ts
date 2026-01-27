import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - List users with salary setup
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get users with basicSalary set (already in salary list)
        const users = await prisma.user.findMany({
            where: {
                basicSalary: { not: null },
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                employeeType: true,
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
                departments: {
                    select: { name: true }
                },
                role: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        // Get all active users for dropdown
        const allUsers = await prisma.user.findMany({
            where: {
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                employeeType: true,
                basicSalary: true,
            },
            orderBy: { name: 'asc' }
        })

        return NextResponse.json({ users, allUsers })
    } catch (error) {
        console.error('[API] Error fetching salary users:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Add user to salary list (set basicSalary and config)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            userId,
            basicSalary,
            employeeType,
            overtimeRateNormal,
            overtimeCalcTypeNormal,
            overtimeRateHoliday,
            overtimeCalcTypeHoliday,
            overtimeRateNational,
            overtimeCalcTypeNational,
            woIncentiveRate,
            lateDeductionRate,
            absentDeductionRate,
        } = body

        if (!userId) {
            return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 })
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                basicSalary: basicSalary || 0,
                employeeType: employeeType || 'KARYAWAN',
                overtimeRateNormal,
                overtimeCalcTypeNormal: overtimeCalcTypeNormal || 'PER_HOUR',
                overtimeRateHoliday,
                overtimeCalcTypeHoliday: overtimeCalcTypeHoliday || 'PER_HOUR',
                overtimeRateNational,
                overtimeCalcTypeNational: overtimeCalcTypeNational || 'PER_HOUR',
                woIncentiveRate,
                lateDeductionRate,
                absentDeductionRate,
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error adding salary user:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
