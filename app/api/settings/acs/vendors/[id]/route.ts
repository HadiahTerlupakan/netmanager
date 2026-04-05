import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { acsVendorSchema, type AcsVendorInput } from '@/lib/validations/settings'
import { deleteAcsVendor, updateAcsVendor } from '@/modules/settings'

export const PUT = createHandler<AcsVendorInput>({
  auth: true,
  permissions: ['acs:update'],
  schema: acsVendorSchema,
}, async (_req, ctx) => {
  const id = ctx.params.id

  try {
    const updatedVendor = await updateAcsVendor(id, ctx.validated)
    return apiSuccess(updatedVendor)
  } catch (error) {
    if (error instanceof Error && error.message === 'VENDOR_NAME_EXISTS') {
      return ApiErrors.conflict('Nama vendor sudah digunakan')
    }

    throw error
  }
})

export const DELETE = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const id = ctx.params.id
  await deleteAcsVendor(id)
  return apiSuccess({ success: true })
})
