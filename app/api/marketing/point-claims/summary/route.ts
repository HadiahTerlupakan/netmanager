import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getPointClaimService } from '@/lib/repositories'

// GET - Get point summary for current user or specific sales
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    let salesId = searchParams.get('salesId') || session.id

    // Regular users can only see their own summary
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    if (!isSuperAdmin && salesId !== session.id) {
      salesId = session.id
    }

    const service = getPointClaimService()
    const summary = await service.getPointSummary(salesId)

    return NextResponse.json(summary)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
