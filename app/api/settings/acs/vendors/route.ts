import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { acsVendorSchema, type AcsVendorInput } from '@/lib/validations/settings'
import { createAcsVendor, listAcsVendors } from '@/modules/settings'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  return apiSuccess(await listAcsVendors())
})

export const POST = createHandler<AcsVendorInput>({
  auth: true,
  permissions: ['acs:update'],
  schema: acsVendorSchema,
}, async (_req, ctx) => {
  try {
    return apiSuccess(await createAcsVendor(ctx.validated))
  } catch (error) {
    if (error instanceof Error && error.message === 'VENDOR_NAME_EXISTS') {
      return ApiErrors.conflict('Nama vendor sudah digunakan')
    }

    throw error
  }
})
