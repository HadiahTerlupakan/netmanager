import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getCanvasingService } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { z } from 'zod'

const completeSchema = z.object({
  fotoInstalasi: z.string().min(1, 'Foto bukti instalasi wajib diunggah'),
  sn: z.string().optional()
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    const body = await req.json()
    const validationResult = completeSchema.safeParse(body)
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues.map(e => e.message).join(', ')
      return ApiErrors.badRequest(`Validasi gagal: ${errorMessage}`)
    }

    const service = getCanvasingService()
    const request = await service.completeCanvasing(
      id, 
      session.id, 
      validationResult.data.fotoInstalasi, 
      validationResult.data.sn
    )

    return apiSuccess(request, { message: 'Canvasing berhasil diselesaikan' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menyelesaikan canvasing'
    return ApiErrors.internalError(message)
  }
}
