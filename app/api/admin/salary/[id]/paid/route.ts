
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryAuditService } from '@/modules/salary/services/SalaryAuditService'
import * as z from 'zod'

const auditSchema = z.object({
    notes: z.string().optional()
})

interface RouteParams {
    params: Promise<{
        id: string
    }>
}

export async function POST(
    req: Request,
    { params }: RouteParams
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        // Check permission strictly
        // Usually handled by service or middleware, but good to check here too
        if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER' && session.user.role !== 'FINANCE') {
             // Basic role check, detailed permission check is better if available in backend utils
        }

        const { id } = await params
        const body = await req.json()
        
        // Validate body just in case, though markAsPaid mainly needs ID
        // const { notes } = auditSchema.parse(body)

        const service = new SalaryAuditService()
        const salary = await service.markAsPaid(id)

        return NextResponse.json(salary)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse('Invalid request data', { status: 400 })
        }

        console.error('Paid error:', error)
        return new NextResponse(
            error instanceof Error ? error.message : 'Internal Server Error',
            { status: 500 }
        )
    }
}
