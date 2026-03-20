import { prisma, prismaAuth } from '@/lib/prisma'

/**
 * @deprecated This function implements the old bypass logic and should not be used for access control.
 * Use standard RBAC permissions instead.
 */
export async function canAccessCanvasingMobile(userId: string): Promise<boolean> {
  const user = await prismaAuth.user.findUnique({
    where: { id: userId },
    select: {
      isSales: true,
      role: {
        select: { name: true }
      }
    }
  })

  if (!user) return false

  // 1. SUPER_ADMIN bypass - always allowed
  if (user.role?.name === 'SUPER_ADMIN') return true

  // 2. isSales = true → Sales or Teknisi merangkap Sales
  return user.isSales === true
}

/**
 * Get user features for mobile app.
 * Formerly included canvasing bypass logic, now strictly follows RBAC permissions.
 * The 'm_canvasing' feature will only be present if assigned via role permissions.
 */
export async function getUserFeaturesWithCanvasing(userId: string): Promise<string[]> {
  const user = await prismaAuth.user.findUnique({

    where: { id: userId },
    include: {
      role: {
        include: {
          permission: true
        }
      }
    }
  })


  if (!user?.role?.permission) return []

  // Get mobile features only (m_* prefix) from role permissions.
  // Admin resources (non-m_*) are intentionally excluded —
  // mobile app only needs mobile permissions, admin permissions are irrelevant here.
  const roleFeatures = [...new Set(
    user.role.permission
      .map(p => p.resource)
      .filter(resource => resource.startsWith('m_'))
  )]

  // Return all mobile features (Karyawan)
  return roleFeatures
}
