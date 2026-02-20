/**
 * Sanitizes permission arrays based on panel access flags.
 * - If accessEmployeePanel is false, strips all permissions whose resource starts with "m_"
 * - If accessAdminPanel is false, strips all permissions whose resource does NOT start with "m_"
 *
 * This acts as a backend safety net to prevent permission/panel mismatch,
 * regardless of what the frontend sends.
 */
export async function sanitizePermissionsByPanelAccess(
  permissions: string[],
  accessAdminPanel: boolean,
  accessEmployeePanel: boolean
): Promise<string[]> {
  if (permissions.length === 0) return []

  // If both panels are active, no filtering needed
  if (accessAdminPanel && accessEmployeePanel) return permissions

  const filtered = permissions.filter((p) => {
    // p is "resource:action"
    const [resource] = p.split(':')
    const isMobileResource = resource.startsWith('m_')

    // If employee panel is off, remove all mobile (m_*) permissions
    if (!accessEmployeePanel && isMobileResource) return false

    // If admin panel is off, remove all admin (non-m_*) permissions
    if (!accessAdminPanel && !isMobileResource) return false

    return true
  })

  return filtered
}
