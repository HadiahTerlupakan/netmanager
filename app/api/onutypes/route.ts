import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOnuTypeRepository } from '@/lib/repositories'
import { onuTypeCreateSchema } from '@/lib/validations/onutype'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
      const onuTypeRepository = getOnuTypeRepository()
      const onuTypes = await onuTypeRepository.findAll()
      return NextResponse.json({ onuTypes })
    } catch (repoError: any) {
      console.error('Error in OnuTypeRepository:', repoError)
      // Jika error terkait model tidak ditemukan
      if (repoError.message?.includes('findMany') || repoError.message?.includes('onuType') || repoError.code === 'P2021') {
        return NextResponse.json(
          {
            error: 'Model OnuType belum tersedia. Silakan restart server Next.js setelah menjalankan: npx prisma generate',
            onuTypes: []
          },
          { status: 500 }
        )
      }
      throw repoError
    }
  } catch (error: any) {
    console.error('Error fetching OnuTypes:', error)
    // Jika error terkait tabel tidak ditemukan, beri pesan yang lebih jelas
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('Unknown model')) {
      return NextResponse.json(
        {
          error: 'Tabel OnuType belum dibuat di database. Silakan jalankan: npx prisma db push --accept-data-loss',
          onuTypes: []
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: error?.message || 'Gagal memuat data OnuType', onuTypes: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = onuTypeCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const onuTypeRepository = getOnuTypeRepository()
    const created = await onuTypeRepository.create(parsed.data)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'ONU Type',
        userId: session.user.id,
        details: { id: created.id, name: parsed.data.name }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ id: created.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'OnuType dengan nama tersebut sudah ada untuk OLT ini atau terjadi kesalahan' }, { status: 409 })
  }
}
