import { prisma } from '@/lib/prisma'

/**
 * Evaluates if a user can access the Canvasing feature on MOBILE APP.
 * 
 * This is SEPARATE from Admin Portal RBAC which uses canvasing:read permission.
 * 
 * Mobile Access Logic:
 * 1. SUPER_ADMIN → Always allowed
 * 2. isSales = true → Allowed (Sales or Teknisi merangkap Sales)
 * 3. Otherwise → Denied
 * 
 * Note: For Admin Portal, use RBAC permissions (canvasing:read, etc.)
 * 
 * @param userId - The user ID to check
 * @returns boolean - True if user can access Canvasing on Mobile
 */
export async function canAccessCanvasingMobile(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
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
 * Get user features for mobile app with canvasing access evaluated.
 * Only adds m_canvasing if user has isSales = true or is SUPER_ADMIN.
 */
export async function getUserFeaturesWithCanvasing(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
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

  // Get base features from role
  const roleFeatures = [...new Set(user.role.permission.map(p => p.resource))]

  // Check mobile canvasing access (isSales based, not RBAC)
  const hasCanvasingAccess = await canAccessCanvasingMobile(userId)

  if (hasCanvasingAccess) {
    // Ensure m_canvasing is included for mobile
    if (!roleFeatures.includes('m_canvasing')) {
      roleFeatures.push('m_canvasing')
    }
  } else {
    // Remove m_canvasing if not allowed
    const idx = roleFeatures.indexOf('m_canvasing')
    if (idx > -1) {
      roleFeatures.splice(idx, 1)
    }
  }

  return roleFeatures
}
