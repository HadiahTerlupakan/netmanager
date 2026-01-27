import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryAuditService } from '@/modules/salary/services/SalaryAuditService'

const auditService = new SalaryAuditService()

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/admin/salary/[id]/audit - Audit actions
 * Actions: 'audit', 'revise'
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const { action, notes, reason } = body
        const userId = session.user.id

        if (!userId) {
            return NextResponse.json({ error: 'User ID not found' }, { status: 401 })
        }

        switch (action) {
            case 'audit':
                await auditService.audit(id, userId, notes)
                return NextResponse.json({ 
                    success: true, 
                    message: 'Salary marked as audited' 
                })

            case 'revise':
                if (!reason) {
                    return NextResponse.json(
                        { error: 'Reason is required for revision request' },
                        { status: 400 }
                    )
                }
                await auditService.requestRevision(id, userId, reason)
                return NextResponse.json({ 
                    success: true, 
                    message: 'Revision requested' 
                })

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use "audit" or "revise"' },
                    { status: 400 }
                )
        }
    } catch (error) {

        console.error('Error in audit action:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process audit action' },
            { status: 500 }
        )
    }
}
