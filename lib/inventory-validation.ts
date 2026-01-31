import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import type { UserSession } from '@/lib/auth'

/**
 * Validate if user has access to the target Gudang based on RBAC and Site restrictions.
 * Rules:
 * 1. SUPER_ADMIN -> Allowed
 * 2. User WITHOUT 'k_barang:site_only' -> Allowed (Assumes global access or access managed by other means)
 * 3. User WITH 'k_barang:site_only' -> Must have siteId matching one of the Gudang's sites.
 */
export async function validateGudangAccess(session: Session, gudangId: string): Promise<{ allowed: boolean; error?: string }> {
  // 1. Check Super Admin
  const user = session.user as UserSession
  const userRole = user.role
  if (userRole === 'SUPER_ADMIN') {
    return { allowed: true }
  }

  // 2. Check Permission
  const permissions = user.permissions || []
  const hasSiteRestriction = permissions.includes('k_barang:site_only')

  if (!hasSiteRestriction) {
    return { allowed: true }
  }

  // 3. Check Site Match
  const userSiteId = user.siteId
  if (!userSiteId) {
    return { allowed: false, error: 'User tidak memiliki Site ID namun dibatasi aksesnya per Site.' }
  }

  const gudang = await prisma.gudang.findUnique({
    where: { id: gudangId },
    include: { sites: true }
  })

  if (!gudang) {
    return { allowed: false, error: 'Gudang tidak ditemukan.' }
  }

  const hasAccess = gudang.sites.some(site => site.id === userSiteId)

  if (!hasAccess) {
    return { allowed: false, error: 'Anda tidak memiliki akses ke Gudang ini (Beda Site).' }
  }

  return { allowed: true }
}
