
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryRepository } from '@/modules/salary/repositories/SalaryRepository'
import { SalaryCalculatorService } from '@/modules/salary/services/SalaryCalculatorService'

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { id } = await params
        const repo = new SalaryRepository()
        const salary = await repo.findById(id)

        if (!salary) {
            return new NextResponse('Salary record not found', { status: 404 })
        }

        if (salary.status !== 'CALCULATED' && salary.status !== 'REVISED') {
             return new NextResponse(
                `Cannot recalculate. Status is ${salary.status}`, 
                { status: 400 }
            )
        }

        const calculator = new SalaryCalculatorService()
        await calculator.calculateAndSave(salary.userId, salary.month, salary.year)

        return NextResponse.json({ success: true })
        
    } catch (error: any) {
        console.error('Recalculate error:', error)
        return new NextResponse(error.message || 'Internal Server Error', { status: 500 })
    }
}
