import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { getPointClaimService } from '@/lib/repositories'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

// GET - Get detail claim
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Session tidak valid')

    const { id } = await params
    const service = getPointClaimService()
    const claim = await service.getClaimById(id)

    if (!claim) {
      return ApiErrors.notFound('Claim')
    }

    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    const isAdmin = isSuperAdmin || permissions.includes('point_claims:read')
    const isOwner = claim.salesId === session.id

    if (!isAdmin && !isOwner) {
      return ApiErrors.forbidden('Anda tidak memiliki akses ke claim ini')
    }

    return apiSuccess(claim)
  } catch (error: any) {
    return ApiErrors.internalError(error.message || 'Gagal mengambil data claim')
  }
}

// PUT - Admin approve/reject claim
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Session tidak valid')

    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    const canManage = isSuperAdmin || 
      permissions.includes('point_claims:update') || 
      permissions.includes('canvasing:update') ||
      permissions.includes('marketing:update')

    if (!canManage) {
      return ApiErrors.forbidden('Missing point_claims:update atau canvasing:update permission')
    }

    const { id } = await params
    const body = await req.json()
    const service = getPointClaimService()

    let result
    if (body.action === 'approve') {
      result = await service.approveClaim(id, session.id, body.notes)
    } else if (body.action === 'reject') {
      if (!body.notes) {
        return apiError('Alasan penolakan wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
      }
      result = await service.rejectClaim(id, session.id, body.notes)
    } else {
      return apiError('Action tidak valid. Gunakan approve atau reject', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    return apiSuccess(result, { message: `Claim berhasil di-${body.action}` })
  } catch (error: any) {
    if (error.message.includes('tidak ditemukan')) {
      return ApiErrors.notFound('Claim')
    }
    if (error.message.includes('Hanya claim')) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
    return ApiErrors.internalError(error.message || 'Gagal memproses claim')
  }
}

// DELETE - Admin delete claim
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Session tidak valid')

    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    const canManage = isSuperAdmin || permissions.includes('point_claims:delete')

    if (!canManage) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus claim')
    }

    const { id } = await params
    const service = getPointClaimService()
    await service.deleteClaim(id)

    return apiSuccess(null, { message: 'Claim berhasil dihapus' })
  } catch (error: any) {
    if (error.message.includes('tidak ditemukan')) {
      return ApiErrors.notFound('Claim')
    }
    if (error.message.includes('tidak bisa dihapus')) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
    return ApiErrors.internalError(error.message || 'Gagal menghapus claim')
  }
}
