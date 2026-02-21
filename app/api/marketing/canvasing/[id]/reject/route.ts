import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { getCanvasingService } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { z } from 'zod'

const rejectSchema = z.object({
  rejectReason: z.string().min(3, 'Alasan penolakan minimal 3 karakter').trim()
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    const canVerify = isSuperAdmin || permissions.includes('canvasing:update')

    if (!canVerify) {
      return ApiErrors.forbidden('Anda tidak memiliki izin untuk menolak canvasing')
    }

    const body = await req.json()
    const validationResult = rejectSchema.safeParse(body)
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues.map(e => e.message).join(', ')
      return ApiErrors.badRequest(`Validasi gagal: ${errorMessage}`)
    }

    const service = getCanvasingService()
    const request = await service.rejectRequest(id, validationResult.data.rejectReason)

    return apiSuccess(request, { message: 'Canvasing berhasil ditolak' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menolak canvasing'
    return ApiErrors.internalError(message)
  }
}
