import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await verifyAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Add RBAC permission check
    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    const service = getMixRadiusService()
    const customerDetail = await service.fetchCustomerDetail(id)

    return NextResponse.json({
      success: true,
      data: customerDetail,
    })
  } catch (error) {
    console.error('Error fetching customer detail:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch customer detail',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
