import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getCanvasingService } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    const service = getCanvasingService()
    const request = await service.claimCommission(id, session.id)

    return apiSuccess(request, { message: 'Komisi canvasing berhasil ditarik' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menarik komisi'
    return ApiErrors.internalError(message)
  }
}
