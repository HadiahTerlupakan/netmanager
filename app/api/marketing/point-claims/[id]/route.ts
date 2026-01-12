import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getPointClaimService } from '@/lib/repositories'

// GET - Get detail claim
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const service = getPointClaimService()
    const claim = await service.getClaimById(id)

    if (!claim) {
      return NextResponse.json({ error: 'Claim tidak ditemukan' }, { status: 404 })
    }

    // Check access - only owner or admin can view
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    const permissions = await getUserPermissions(session.id)
    const isAdmin = isSuperAdmin || permissions.includes('point_claims:read')
    const isOwner = claim.salesId === session.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke claim ini' }, { status: 403 })
    }

    return NextResponse.json(claim)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Admin approve/reject claim
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check admin permissions
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    const permissions = await getUserPermissions(session.id)
    const canManage = isSuperAdmin || permissions.includes('point_claims:write') || permissions.includes('canvasing:write')

    if (!canManage) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengelola claim' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const service = getPointClaimService()

    let result
    if (body.action === 'approve') {
      result = await service.approveClaim(id, session.id, body.notes)
    } else if (body.action === 'reject') {
      if (!body.notes) {
        return NextResponse.json({ error: 'Alasan penolakan wajib diisi' }, { status: 400 })
      }
      result = await service.rejectClaim(id, session.id, body.notes)
    } else {
      return NextResponse.json({ error: 'Action tidak valid. Gunakan approve atau reject' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message.includes('tidak ditemukan')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message.includes('Hanya claim')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Admin delete claim
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check admin permissions
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    const permissions = await getUserPermissions(session.id)
    const canManage = isSuperAdmin || permissions.includes('point_claims:delete')

    if (!canManage) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menghapus claim' }, { status: 403 })
    }

    const { id } = await params
    const service = getPointClaimService()
    await service.deleteClaim(id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message.includes('tidak ditemukan')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message.includes('tidak bisa dihapus')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
