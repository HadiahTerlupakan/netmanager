import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getPointClaimService } from '@/lib/repositories'

// GET - List all claims (admin) atau claims by sales (mobile)
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    const permissions = await getUserPermissions(session.id)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read') || permissions.includes('point_claims:read')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as any
    let salesId = searchParams.get('salesId') || undefined

    // If user cannot read all, force filter to their own ID
    if (!canReadAll) {
      salesId = session.id
    }

    const service = getPointClaimService()
    const claims = await service.getAllClaims({ status, salesId })

    return NextResponse.json(claims)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
