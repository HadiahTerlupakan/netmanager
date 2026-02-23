import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  const vendors = await prisma.acsVendor.findMany({
    orderBy: [{ priority: 'desc' }, { name: 'asc' }]
  })
  return apiSuccess(vendors)
})

export const POST = createHandler({ auth: true, permissions: ['acs:update'] }, async (req) => {
  const body = await req.json()
  const { name, manufacturerPatterns, productPatterns, parameterPrefix, priority, enabled } = body

  if (!name || !manufacturerPatterns || !productPatterns) {
    return ApiErrors.badRequest('Nama, Manufacturer, dan Product Patterns harus diisi')
  }

  const newVendor = await prisma.acsVendor.create({
    data: {
      name,
      manufacturerPatterns,
      productPatterns,
      parameterPrefix,
      priority: priority || 10,
      enabled: enabled !== false,
      // Default paths
      serviceListPath: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.*.WANPPPConnection.*.X_BROADCOM_COM_IGMP_VLANID',
      vlanIdPath: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.*.WANPPPConnection.*.X_BROADCOM_COM_IGMP_VLANID',
      description: body.description || ''
    }
  })

  return apiSuccess(newVendor)
})
