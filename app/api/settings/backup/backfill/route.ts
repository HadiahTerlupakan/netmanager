import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { hasPermission } from '@/lib/rbac'
import { runBackupBackfillJob } from '@/modules/settings'

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return ApiErrors.unauthorized('Session tidak valid')
  }

  const canBackfill = await hasPermission('backup_database:delete', session.user)
  if (!canBackfill) {
    return ApiErrors.forbidden('Anda tidak memiliki permission untuk melakukan sinkronisasi ini')
  }

  try {
    const result = await runBackupBackfillJob()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return ApiErrors.internalError(`Gagal menjalankan sinkronisasi: ${message}`)
  }
}
