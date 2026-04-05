import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { testR2Connection } from '@/lib/utils/r2-client'

/**
 * POST /api/settings/api/r2/test
 * Test koneksi ke Cloudflare R2
 */
export const POST = createHandler({ auth: true, permissions: ['settings:update'] }, async (req) => {
    const body = await req.json()
    const { accountId, accessKeyId, secretAccessKey, bucketName } = body

    // Validate required fields
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        return ApiErrors.badRequest('Semua field wajib diisi untuk test koneksi')
    }

    // Test connection
    const result = await testR2Connection({
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl: ''
    })

    if (result.success) {
        return apiSuccess({
            success: true,
            message: 'Koneksi ke Cloudflare R2 berhasil!'
        })
    } else {
        return ApiErrors.badRequest(result.error || 'Koneksi gagal')
    }
})
