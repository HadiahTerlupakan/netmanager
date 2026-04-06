import { NextResponse } from 'next/server'
import { ApiErrors, createHandler } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'
import { isMainTenant } from '@/modules/mitra'
import { resetDatabasesAndSchema } from '@/modules/settings'

const RESET_CONFIRMATION_TEXT = 'RESET DATABASE'

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user

  if (!isMainTenant(user.tenantId)) {
    return ApiErrors.forbidden('Hanya tenant utama yang bisa mengakses fitur reset database')
  }

  if (!await hasPermission('backup_database:delete', user)) {
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
    console.error('Error resetting settings backup data:', error)
    return ApiErrors.internalError('Gagal reset backup')
  }
})
