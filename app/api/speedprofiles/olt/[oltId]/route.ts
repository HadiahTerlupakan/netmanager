import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getSpeedProfileRepository } from '@/lib/repositories'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ oltId: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { oltId } = await params
    const speedProfileRepository = getSpeedProfileRepository()
    const speedProfiles = await speedProfileRepository.findByOltId(oltId)
    return NextResponse.json({ speedProfiles })
  } catch (error: any) {
    console.error('Error fetching SpeedProfiles by OLT:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat data SpeedProfile', speedProfiles: [] },
      { status: 500 }
    )
  }
}

