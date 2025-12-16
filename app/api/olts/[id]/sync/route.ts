import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { getOltSyncService } from '@/lib/services/OltSyncService'

export const maxDuration = 600 // 10 menit dalam detik
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }
  if (!olt.snmpConnected) {
    return NextResponse.json({ error: 'SNMP tidak connected. Silakan test connection terlebih dahulu.' }, { status: 400 })
  }

  // Update progress ke 1% segera untuk menunjukkan sync sudah dimulai
  try {
    await oltRepository.update(id, {
      syncStatus: '1',
    })
  } catch (updateError: any) {
    console.error(`[OLT-Sync] Failed to update initial progress:`, updateError.message)
  }

  // Use the service to start sync
  const oltSyncService = getOltSyncService()

  // Start async (fire and forget from API perspective)
  setTimeout(() => {
    oltSyncService.startSync(id)
      .catch(err => console.error('[OLT-Sync] Sync service failed:', err))
  }, 0)

  // Langsung return response tanpa menunggu sync selesai
  return NextResponse.json({
    success: true,
    message: 'Sync dimulai di background. Progress dapat dilihat di kolom Synchronization Status.',
    oltId: id,
    oltName: olt.name,
  })
}
