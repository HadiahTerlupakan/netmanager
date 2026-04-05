import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { hasPermission } from '@/lib/rbac'
import { resetDatabasesAndSchema } from '@/modules/settings'

const RESET_CONFIRMATION_TEXT = 'RESET DATABASE'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return ApiErrors.unauthorized('Session tidak valid')
  }

  const canReset = await hasPermission('backup_database:delete', session.user)
  if (!canReset) {
    return ApiErrors.forbidden('Anda tidak memiliki permission untuk reset database')
  }

  const body = (await req.json().catch((): null => null)) as { confirmationText?: string } | null
  if (!body?.confirmationText || body.confirmationText !== RESET_CONFIRMATION_TEXT) {
    return ApiErrors.badRequest(`Konfirmasi tidak valid. Harus tepat: ${RESET_CONFIRMATION_TEXT}`)
  }

  try {
    const result = await resetDatabasesAndSchema()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return ApiErrors.internalError(`Gagal reset backup: ${message}`)
  }
}
