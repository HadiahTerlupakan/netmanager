import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { r2ConnectionTestSchema, type R2ConnectionTestInput } from '@/lib/validations/settings'
import { testCloudflareR2Connection } from '@/modules/settings'

/**
 * POST /api/settings/api/r2/test
 * Test koneksi ke Cloudflare R2
 */
export const POST = createHandler<R2ConnectionTestInput>(
  {
    auth: true,
    permissions: ['settings:update'],
    schema: r2ConnectionTestSchema,
  },
  async (_req, ctx) => {
    const payload = ctx.validated

    const result = await testCloudflareR2Connection(payload)

    if (result.success) {
      return apiSuccess({
        success: true,
        message: 'Koneksi ke Cloudflare R2 berhasil!',
      })
    }

    const errorMessage = 'error' in result ? result.error : 'Koneksi gagal'
    return ApiErrors.badRequest(errorMessage)
  }
)
