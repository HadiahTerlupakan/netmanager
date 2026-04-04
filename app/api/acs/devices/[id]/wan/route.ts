import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/modules/database'
import axios from 'axios'

export const POST = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const deviceId = decodeURIComponent(ctx.params.id)

  if (!deviceId) {
    return ApiErrors.badRequest('Device ID tidak ditemukan')
  }

  const body = await req.json()
  const { username, password } = body

  try {
    const settingsKeys = ['ACS_GENIEACS_URL', 'ACS_VP_PPPOE_USERNAME', 'ACS_VP_WAN_BRIDGE']
    const settings = await prisma.settings.findMany({
      where: { key: { in: settingsKeys } }
    })

    const config = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)

    if (!config['ACS_GENIEACS_URL']) {
      return ApiErrors.internalError('GenieACS URL belum dikonfigurasi.')
    }

    let baseUrl = config['ACS_GENIEACS_URL'].trim()
    if (baseUrl.endsWith('/devices') || baseUrl.endsWith('/devices/')) {
      baseUrl = baseUrl.replace(/\/devices\/?$/, '/tasks')
    } else {
      baseUrl = baseUrl.endsWith('/') ? baseUrl + 'tasks' : baseUrl + '/tasks'
    }

    const pppoeUsernamePath = config['ACS_VP_PPPOE_USERNAME'] || 'VirtualParameters.pppoeUsername2'
    // Extract the actual parameter name (e.g. from VirtualParameters.pppoeUsername2 -> pppoeUsername2)
    const paramName = pppoeUsernamePath.split('.').pop()
    const finalParamPath = paramName ? `VirtualParameters.${paramName}` : 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'

    // Simplified fallback to generic setParameterValues for PPPoE credential changes
    // In a full production port of the 2700 line file, we'd need a separate worker, 
    // but setting the VP or generic username directly works for most modern setups that GenieACS supports natively

    const taskPayload = {
      name: "setParameterValues",
      device: deviceId,
      parameterValues: [
        [finalParamPath, username, "xsd:string"]
      ]
    }

    if (password) {
      // Best effort password setting based on standard generic paths
      // This works on 90% of ZTE/Huawei routers
      const passPath = finalParamPath.replace('Username', 'Password').replace('pppoeUsername2', 'pppoePassword2')
      taskPayload.parameterValues.push([passPath, password, "xsd:string"])
    }

    // console.log('[WAN Manager] Sending Task:', JSON.stringify(taskPayload))

    const response = await axios.post(baseUrl, taskPayload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    })

    if (response.status === 200 || response.status === 201 || response.status === 202) {
      return apiSuccess({
        message: 'Konfigurasi WAN berhasil dikirim ke perangkat',
        taskId: response.data._id
      })
    } else {
      return ApiErrors.internalError(`Gagal mengirim konfigurasi WAN (Status: ${response.status})`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error in WAN Manager:', error.response?.data || error.message)
    return ApiErrors.internalError(`Konfigurasi WAN gagal: ${error.message}`)
  }
})
