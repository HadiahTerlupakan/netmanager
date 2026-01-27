import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryRepository } from '@/modules/salary/repositories/SalaryRepository'
import { SalaryCalculatorService } from '@/modules/salary/services/SalaryCalculatorService'
import { SalaryStatus, EmployeeType } from '@prisma/client'

const salaryRepo = new SalaryRepository()
const calculatorService = new SalaryCalculatorService()

/**
 * GET /api/admin/salary - Get all salaries with filters
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        
        const filters = {
            month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
            year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
            status: searchParams.get('status') as SalaryStatus | undefined,
            userId: searchParams.get('userId') || undefined,
            departmentId: searchParams.get('departmentId') || undefined,
            siteId: searchParams.get('siteId') || undefined,
            employeeType: searchParams.get('employeeType') || undefined,
            skip: searchParams.get('skip') ? parseInt(searchParams.get('skip')!) : 0,
            take: searchParams.get('take') ? parseInt(searchParams.get('take')!) : 50
        }

        const { salaries, total } = await salaryRepo.findAll(filters)

        // Get period stats if month and year are specified
        let stats = null
        if (filters.month && filters.year) {
            stats = await salaryRepo.getPeriodStats(filters.month, filters.year)
        }

        return NextResponse.json({
            salaries,
            total,
            stats,
            page: Math.floor((filters.skip || 0) / (filters.take || 50)) + 1,
            totalPages: Math.ceil(total / (filters.take || 50))
        })
    } catch (error) {
        console.error('Error fetching salaries:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch salaries' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/salary - Calculate salary (single or bulk)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { action, userId, month, year, departmentId, siteId, employeeType } = body

        if (!month || !year) {
            return NextResponse.json(
                { error: 'Month and year are required' },
                { status: 400 }
            )
        }

        if (action === 'calculate-single' && userId) {
            // Calculate for single user
            const salaryId = await calculatorService.calculateAndSave(userId, month, year)
            return NextResponse.json({ 
                success: true, 
                salaryId,
                message: 'Salary calculated successfully'
            })
        } else if (action === 'calculate-bulk') {
            // Bulk calculate for all users
            const result = await calculatorService.calculateBulk(month, year, {
                departmentId,
                siteId,
                employeeType: employeeType as EmployeeType
            })

            return NextResponse.json({
                success: true,
                calculated: result.success,
                failed: result.failed,
                message: `${result.success} salaries calculated, ${result.failed.length} failed`
            })
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "calculate-single" or "calculate-bulk"' },
                { status: 400 }
            )
        }
    } catch (error) {
        console.error('Error calculating salary:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to calculate salary' },
            { status: 500 }
        )
    }
}
