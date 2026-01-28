import { getHybridUser } from '@/lib/hybrid-auth'
import { getJoinboxRepository } from '@/lib/repositories'
import { joinboxCreateSchema } from '@/lib/validations/joinbox'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

/**
 * @swagger
 * /api/joinboxes:
 *   get:
 *     summary: Get all Joinbox records
 *     tags: [FTTH Infrastructure]
 */
export async function GET(req: Request) {
  const repo = getJoinboxRepository()
  const items = await repo.findAll()
  return apiSuccess({ items })
}

export async function POST(req: Request) {
  const user = await getHybridUser(req)
  if (!user) return ApiErrors.unauthorized('Session tidak valid')
  const json = await req.json()
  const parsed = joinboxCreateSchema.safeParse(json)
  if (!parsed.success) {
    return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
      status: 400, 
      details: { errors: parsed.error.flatten() } 
    })
  }
  const repo = getJoinboxRepository()
  const created = await repo.create(parsed.data as any)

  try {
    const { logger } = await import('@/lib/logger')
    if (user.id) {
        await logger.logActivity({
        action: 'CREATE',
        subject: 'Joinbox',
        userId: user.id as string,
        details: { id: created.id, name: parsed.data.name }
        })
    }
  } catch (e) {
    console.error('Logging failed', e)
  }

  return apiSuccess({ id: created.id }, { status: 201, message: 'Joinbox berhasil dibuat' })
}
