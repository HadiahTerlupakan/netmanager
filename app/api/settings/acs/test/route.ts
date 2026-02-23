import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import axios from 'axios'

export const POST = createHandler({ auth: true, permissions: ['acs:read'] }, async (req) => {
  const body = await req.json()

  if (!body.url) {
    return ApiErrors.badRequest('URL tidak boleh kosong')
  }

  try {
    // Ping to the provided URL to check if it's reachable.
    // We add a short timeout to prevent it from hanging too long.
    const res = await axios.get(body.url, {
      timeout: 5000,
      validateStatus: () => true // Allow any status code (401, 403, 404) as long as it connects
    })

    return apiSuccess({
      reachable: true,
      status: res.status,
      message: 'Koneksi ke server ACS berhasil!'
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Test ACS URL Error:', error.message)
    return apiSuccess({
      reachable: false,
      message: `Koneksi gagal: ${error.message || 'Tidak dapat menjangkau server'}`
    })
  }
})
