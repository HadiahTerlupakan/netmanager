/**
 * Priority/Notification Shared Helpers
 * Centralized utility functions for notification components
 * Eliminates duplication across AdminNotificationBell, WorkOrderBell, CustomerSupportBell
 */

/**
 * Get border-left color class for notification priority
 * @param priority - Priority level string (URGENT, CRITICAL, HIGH, MEDIUM, etc.)
 * @param defaultColor - Default color class when priority doesn't match (default: 'border-l-indigo-500')
 */
export function getPriorityColor(priority: string, defaultColor = 'border-l-indigo-500'): string {
  switch (priority) {
    case 'URGENT':
    case 'CRITICAL':
      return 'border-l-red-500'
    case 'HIGH':
      return 'border-l-orange-500'
    case 'MEDIUM':
      return 'border-l-yellow-500'
    default:
      return defaultColor
  }
}
