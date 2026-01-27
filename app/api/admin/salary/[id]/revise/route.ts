
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryAuditService } from '@/modules/salary/services/SalaryAuditService'
import * as z from 'zod'

const reviseSchema = z.object({
    reason: z.string().min(1, 'Reason is required')
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
        if (!session || !session.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { id } = await params
        const body = await req.json()
        const { reason } = reviseSchema.parse(body)

        const service = new SalaryAuditService()
        // Note: The Implementation Plan mentioned /revise but SalaryAuditService has requestRevision
        // Let's assume requestRevision is what we want for "Minta Revisi"
        const salary = await service.requestRevision(id, reason, session.user.id)

        return NextResponse.json({ success: true })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse('Invalid request data', { status: 400 })
        }

        console.error('Revise error:', error)
        return new NextResponse(
            error instanceof Error ? error.message : 'Internal Server Error',
            { status: 500 }
        )
    }
}
