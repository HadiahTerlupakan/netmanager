import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { getOltSyncService } from '@/modules/network'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

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
  if (!session) return ApiErrors.unauthorized('Session tidak valid')

  const { id } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return ApiErrors.notFound('OLT')
  }
  if (!olt.snmpConnected) {
    return apiError('SNMP tidak connected. Silakan test connection terlebih dahulu.', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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
  return apiSuccess({
    message: 'Sync dimulai di background. Progress dapat dilihat di kolom Synchronization Status.',
    oltId: id,
    oltName: olt.name,
  })
}
