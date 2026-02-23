import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  const configs = await prisma.acsWifiSecurity.findMany({
    orderBy: { productClass: 'asc' }
  })
  return apiSuccess(configs)
})

export const POST = createHandler({ auth: true, permissions: ['acs:update'] }, async (req) => {
  const body = await req.json()
  const { productClass, parameterPath, wpaTypes, encryptTypes } = body

  if (!productClass || !parameterPath) {
    return ApiErrors.badRequest('Product Class dan Parameter Path harus diisi')
  }

  const newConfig = await prisma.acsWifiSecurity.upsert({
    where: { productClass },
    update: {
      parameterPath,
      wpaTypes,
      encryptTypes
    },
    create: {
      productClass,
      parameterPath,
      wpaTypes,
      encryptTypes
    }
  })

  return apiSuccess(newConfig)
})
