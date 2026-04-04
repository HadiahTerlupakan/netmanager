import { createHandler, apiSuccess } from '@/lib/api'
import { prisma } from '@/modules/database'

export const PUT = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const id = ctx.params.id
  const body = await req.json()
  
  const updatedVendor = await prisma.acsVendor.update({
    where: { id },
    data: {
      name: body.name,
      manufacturerPatterns: body.manufacturerPatterns,
      productPatterns: body.productPatterns,
      parameterPrefix: body.parameterPrefix,
      priority: body.priority,
      enabled: body.enabled,
      description: body.description
    }
  })
  return apiSuccess(updatedVendor)
})

export const DELETE = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const id = ctx.params.id
  await prisma.acsVendor.delete({ where: { id } })
  return apiSuccess({ success: true })
})
