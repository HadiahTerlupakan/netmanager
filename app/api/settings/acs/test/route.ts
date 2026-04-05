import { createHandler, apiSuccess } from '@/lib/api'
import axios from 'axios'
import { acsTestUrlSchema, type AcsTestUrlInput } from '@/lib/validations/settings'

export const POST = createHandler<AcsTestUrlInput>({
  auth: true,
  permissions: ['acs:read'],
  schema: acsTestUrlSchema,
}, async (_req, ctx) => {
  const { url } = ctx.validated

  try {
    // Ping to the provided URL to check if it's reachable.
    // We add a short timeout to prevent it from hanging too long.
    const res = await axios.get(url, {
      timeout: 5000,
      validateStatus: () => true // Allow any status code (401, 403, 404) as long as it connects
    })

    return apiSuccess({
      reachable: true,
      status: res.status,
      message: 'Koneksi ke server ACS berhasil!'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tidak dapat menjangkau server'
    console.error('Test ACS URL Error:', message)
    return apiSuccess({
      reachable: false,
      message: `Koneksi gagal: ${message}`
    })
  }
})
