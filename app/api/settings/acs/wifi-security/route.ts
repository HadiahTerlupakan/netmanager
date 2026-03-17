import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  const configs = await prisma.acsWifiSecurity.findMany({
    orderBy: { productClass: 'asc' }
  })
  return apiSuccess(configs)
})

export const POST = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const body = await req.json()
  const { productClass, parameterPath, wpaTypes, encryptTypes } = body
  const tenantId = ctx.session?.user.tenantId

  if (!productClass || !parameterPath) {
    return ApiErrors.badRequest('Product Class dan Parameter Path harus diisi')
  }

  const newConfig = await prisma.acsWifiSecurity.upsert({
    where: { 
      tenantId_productClass: {
        tenantId: tenantId || '',
        productClass
      }
    },
    update: {
      parameterPath,
      wpaTypes,
      encryptTypes
    },
    create: {
      productClass,
      parameterPath,
      wpaTypes,
      encryptTypes,
      tenantId
    }
  })

  return apiSuccess(newConfig)
})
