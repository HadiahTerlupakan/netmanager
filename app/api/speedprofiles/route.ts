import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getSpeedProfileRepository } from '@/lib/repositories'
import { speedProfileCreateSchema } from '@/lib/validations/speedprofile'

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
      const speedProfileRepository = getSpeedProfileRepository()
      const speedProfiles = await speedProfileRepository.findAll()
      return NextResponse.json({ speedProfiles })
    } catch (repoError: any) {
      console.error('Error in SpeedProfileRepository:', repoError)
      // Jika error terkait model tidak ditemukan
      if (repoError.message?.includes('findMany') || repoError.message?.includes('speedProfile') || repoError.code === 'P2021') {
        return NextResponse.json(
          {
            error: 'Model SpeedProfile belum tersedia. Silakan restart server Next.js setelah menjalankan: npx prisma generate',
            speedProfiles: []
          },
          { status: 500 }
        )
      }
      throw repoError
    }
  } catch (error: any) {
    console.error('Error fetching SpeedProfiles:', error)
    // Jika error terkait tabel tidak ditemukan, beri pesan yang lebih jelas
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('Unknown model')) {
      return NextResponse.json(
        {
          error: 'Tabel SpeedProfile belum dibuat di database. Silakan jalankan: npx prisma db push --accept-data-loss',
          speedProfiles: []
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: error?.message || 'Gagal memuat data SpeedProfile', speedProfiles: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = speedProfileCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const speedProfileRepository = getSpeedProfileRepository()
    const speedProfile = await speedProfileRepository.create({
      oltId: data.oltId,
      profileType: data.profileType,
      name: data.name,
      type: data.type,
      bandwidthSir: data.bandwidthSir,
      burstPir: data.burstPir,
      fixed: data.fixed ?? null,
      assured: data.assured ?? null,
      maximum: data.maximum ?? null,
    })
    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'SpeedProfile',
        userId: session.user.id,
        details: { id: speedProfile.id, name: data.name }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ id: speedProfile.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'SpeedProfile dengan nama tersebut sudah ada untuk OLT ini atau terjadi kesalahan' }, { status: 409 })
  }
}

