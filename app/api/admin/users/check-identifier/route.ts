import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { checkGlobalIdentifier, type RoleToExclude } from '@/lib/validations/global-identifier'

/**
 * @swagger
 * /api/admin/users/check-identifier:
 *   get:
 *     summary: Check if an email or username exists globally
 *     description: Digunakan untuk validasi as-you-type di frontend.
 *     tags: [Users]
 */
export const GET = createHandler({
  auth: true,
  permissions: ['users:read']
}, async (req) => {
  const identifier = req.nextUrl.searchParams.get('identifier') || req.nextUrl.searchParams.get('email')
  const excludeId = req.nextUrl.searchParams.get('excludeId') || undefined
  const excludeRole = req.nextUrl.searchParams.get('excludeRole') as RoleToExclude | undefined

  if (!identifier) {
    return ApiErrors.badRequest('Identifier wajib diisi')
  }

  const result = await checkGlobalIdentifier(identifier, excludeRole, excludeId)

  return apiSuccess(result)
})
