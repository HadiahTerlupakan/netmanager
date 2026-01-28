import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getJoinboxRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { joinboxUpdateSchema } from '@/lib/validations/joinbox'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await prisma.joinbox.findUnique({
    where: { id },
    include: {
      joinboxInput: { orderBy: { idx: 'asc' } },
      joinboxOutput: { orderBy: { idx: 'asc' } },
    },
  })
  if (!item) return ApiErrors.notFound('Joinbox')
  return apiSuccess({ joinbox: item })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return ApiErrors.unauthorized('Session tidak valid')
  const { id } = await params
  const json = await req.json()
  const parsed = joinboxUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
      status: 400, 
      details: { errors: parsed.error.flatten() } 
    })
  }
  const repo = getJoinboxRepository()
  await repo.update(id, parsed.data as any)
  return apiSuccess(null, { message: 'Joinbox berhasil diperbarui' })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return ApiErrors.unauthorized('Session tidak valid')
  const repo = getJoinboxRepository()
  const { id } = await params
  await repo.delete(id)
  return apiSuccess(null, { message: 'Joinbox berhasil dihapus' })
}
