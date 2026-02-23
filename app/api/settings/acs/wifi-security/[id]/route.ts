import { createHandler, apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const PUT = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const id = ctx.params.id
  const body = await req.json()
  
  const updatedConfig = await prisma.acsWifiSecurity.update({
    where: { id },
    data: {
      productClass: body.productClass,
      parameterPath: body.parameterPath,
      wpaTypes: body.wpaTypes,
      encryptTypes: body.encryptTypes
    }
  })
  return apiSuccess(updatedConfig)
})

export const DELETE = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const id = ctx.params.id
  await prisma.acsWifiSecurity.delete({ where: { id } })
  return apiSuccess({ success: true })
})
