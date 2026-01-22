
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { syncService } from '@/modules/integrations/mixradius/SyncService'
import type { MixRadiusCustomerDetail } from '@/modules/integrations/mixradius/MixRadiusService'

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await verifyAuth(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Permission Check
    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Parse Body
    // Expecting the full MixRadius customer object from the frontend
    const body = await req.json()
    const customerData = body as MixRadiusCustomerDetail

    if (!customerData || !customerData.id || !customerData.username) {
        return NextResponse.json({ error: 'Invalid data provided' }, { status: 400 })
    }

    // 4. Perform Sync
    const result = await syncService.syncCustomer(customerData)

    return NextResponse.json({
        success: true,
        action: result.action,
        localId: result.customer.id,
        message: `Successfully ${result.action} customer record`
    })

  } catch (error: any) {
    console.error('[API] MixRadius Sync Error:', error)
    return NextResponse.json({ 
        error: error.message || 'Internal Server Error' 
    }, { status: 500 })
  }
}
