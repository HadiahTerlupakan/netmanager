import { prisma } from '@/lib/prisma'

/**
 * Sanitizes permission IDs based on panel access flags.
 * - If accessEmployeePanel is false, strips all permissions whose resource starts with "m_"
 * - If accessAdminPanel is false, strips all permissions whose resource does NOT start with "m_"
 *
 * This acts as a backend safety net to prevent permission/panel mismatch,
 * regardless of what the frontend sends.
 */
export async function sanitizePermissionsByPanelAccess(
  permissionIds: string[],
  accessAdminPanel: boolean,
  accessEmployeePanel: boolean
): Promise<string[]> {
  if (permissionIds.length === 0) return []

  // If both panels are active, no filtering needed
  if (accessAdminPanel && accessEmployeePanel) return permissionIds

  // Fetch the permissions with their resources
  const permissions = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { id: true, resource: true },
  })

  const filtered = permissions.filter((p) => {
    const isMobileResource = p.resource.startsWith('m_')

    // If employee panel is off, remove all mobile (m_*) permissions
    if (!accessEmployeePanel && isMobileResource) return false

    // If admin panel is off, remove all admin (non-m_*) permissions
    if (!accessAdminPanel && !isMobileResource) return false

    return true
  })

  return filtered.map((p) => p.id)
}
