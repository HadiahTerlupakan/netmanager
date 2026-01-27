import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryAuditService } from '@/modules/salary/services/SalaryAuditService'

const auditService = new SalaryAuditService()

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/admin/salary/[id]/approve - Approval actions
 * Actions: 'approve', 'paid'
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const { action } = body
        const userId = session.user.id

        if (!userId) {
            return NextResponse.json({ error: 'User ID not found' }, { status: 401 })
        }

        switch (action) {
            case 'approve':
                await auditService.approve(id, userId)

                return NextResponse.json({ 
                    success: true, 
                    message: 'Salary approved' 
                })

            case 'paid':
                await auditService.markAsPaid(id)
                return NextResponse.json({ 
                    success: true, 
                    message: 'Salary marked as paid' 
                })

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use "approve" or "paid"' },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error('Error in approval action:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process approval action' },
            { status: 500 }
        )
    }
}
