import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import axios from 'axios'

export const POST = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const deviceId = decodeURIComponent(ctx.params.id)

  if (!deviceId) {
    return ApiErrors.badRequest('Device ID tidak ditemukan')
  }

  const body = await req.json()
  const { taskName = 'setParameterValues', parameter, value, type = 'string', connectionRequest = false } = body

  try {
    const settingsKeys = ['ACS_GENIEACS_URL']
    const settings = await prisma.settings.findMany({
      where: { key: { in: settingsKeys } }
    })

    const config = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)

    if (!config['ACS_GENIEACS_URL']) {
      return ApiErrors.internalError('GenieACS URL belum dikonfigurasi di Pengaturan.')
    }

    let baseUrl = config['ACS_GENIEACS_URL'].trim()
    if (baseUrl.endsWith('/devices') || baseUrl.endsWith('/devices/')) {
      baseUrl = baseUrl.replace(/\/devices\/?$/, '/tasks')
    } else {
      baseUrl = baseUrl.endsWith('/') ? baseUrl + 'tasks' : baseUrl + '/tasks'
    }

    // Custom Summon logic (connection_request)
    if (connectionRequest || taskName === 'connection_request') {
      const summonUrl = config['ACS_GENIEACS_URL'].trim().replace(/\/devices\/?$/, '') + '/devices/' + encodeURIComponent(deviceId) + '/tasks?connection_request'
      await axios.post(summonUrl, null, { timeout: 10000 })
      return apiSuccess({ message: 'Perintah Summon berhasil dikirim' })
    }

    const taskPayload: Record<string, unknown> = {
      name: taskName,
      device: deviceId
    }

    if (taskName === 'setParameterValues') {
      if (!parameter || value === undefined) {
        return ApiErrors.badRequest('Parameter dan value harus diisi')
      }
      taskPayload.parameterValues = [
        [parameter, value, type]
      ]
    } else if (taskName === 'addObject' || taskName === 'deleteObject') {
      if (!parameter) {
        return ApiErrors.badRequest('ObjectName harus diisi')
      }
      taskPayload.objectName = parameter
    }

    // console.log('[GenieACS Task] Sending:', JSON.stringify(taskPayload))

    const response = await axios.post(baseUrl, taskPayload, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 200 || response.status === 201 || response.status === 202) {
      return apiSuccess({
        message: `Task ${taskName} berhasil dikirim ke perangkat`,
        taskId: response.data._id
      })
    } else {
      return ApiErrors.internalError(`Gagal mengirim tugas (Status: ${response.status})`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating ACS task:', error.response?.data || error.message)
    return ApiErrors.internalError(`Koneksi ke GenieACS gagal: ${error.message}`)
  }
})
