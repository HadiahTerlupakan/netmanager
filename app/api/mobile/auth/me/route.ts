import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    const userRepo = getUserRepository()
    const user = await userRepo.findById(session.id)
    
    if (!user) return ApiErrors.notFound('User tidak ditemukan')
    // Check isActive flag instead of status string
    if (user.isActive === false) return ApiErrors.forbidden('Akun Anda tidak aktif')

    const permissions = await getUserPermissions(session.id)

    // Format response matching the mobile app's User type expectations
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: session.role,
      features: permissions,
      isSales: session.role.toUpperCase().includes('SALES'),
      image: user.image,
      // These fields are not in UserPublic/findById select, use defaults for mobile API
      workDays: [] as string[],
      workingHourMode: 'FLEXIBLE',
      isOnLeave: false,
    }

    return apiSuccess(userData)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil profile'
    return ApiErrors.internalError(message)
  }
}
