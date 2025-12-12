import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/hris/employees/next-id
 * Generate the next Employee ID in sequence
 */
export async function GET() {
    try {
        const session: any = await getServerSession(authConfig as any)

        // Only require valid session - role access is handled at UI level via CustomRole
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get the latest employee ID
        const latestEmployee = await prisma.employee.findFirst({
            where: {
                employeeId: {
                    startsWith: 'EMP-'
                }
            },
            orderBy: {
                employeeId: 'desc'
            },
            select: {
                employeeId: true
            }
        })

        let nextNumber = 1
        if (latestEmployee) {
            // Extract number from EMP-XXX format
            const match = latestEmployee.employeeId.match(/EMP-(\d+)/)
            if (match) {
                nextNumber = parseInt(match[1]) + 1
            }
        }

        // Format with leading zeros (EMP-001, EMP-002, etc.)
        const nextId = `EMP-${nextNumber.toString().padStart(3, '0')}`

        return NextResponse.json({ nextId })
    } catch (error: any) {
        console.error('Error generating next employee ID:', error)
        return NextResponse.json(
            { error: 'Failed to generate employee ID' },
            { status: 500 }
        )
    }
}
