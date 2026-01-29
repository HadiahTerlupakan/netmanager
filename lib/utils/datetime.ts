/**
 * Datetime Utilities
 * Timezone-safe date formatting for forms and API communication
 */

/**
 * Format a date string or Date object for datetime-local input
 * Handles timezone correctly without manual offset calculations
 * @param dateStr - ISO date string or Date object
 * @returns String formatted for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export function formatForDateTimeInput(dateStr?: string | Date | null): string {
  if (!dateStr) return ''
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  
  if (isNaN(date.getTime())) return ''
  
  // Get local date components
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Format a date string for date input (YYYY-MM-DD)
 * @param dateStr - ISO date string or Date object
 * @returns String formatted for date input
 */
export function formatForDateInput(dateStr?: string | Date | null): string {
  if (!dateStr) return ''
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  
  if (isNaN(date.getTime())) return ''
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Convert datetime-local input value to ISO string for API
 * @param datetimeLocalValue - Value from datetime-local input
 * @returns ISO string or null
 */
export function toISOString(datetimeLocalValue?: string | null): string | null {
  if (!datetimeLocalValue) return null
  
  const date = new Date(datetimeLocalValue)
  
  if (isNaN(date.getTime())) return null
  
  return date.toISOString()
}

/**
 * Get start of day for a date (00:00:00.000)
 * @param dateStr - Date string (YYYY-MM-DD format)
 * @returns ISO string for start of day
 */
export function getStartOfDay(dateStr: string): string {
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

/**
 * Get end of day for a date (23:59:59.999)
 * @param dateStr - Date string (YYYY-MM-DD format)
 * @returns ISO string for end of day
 */
export function getEndOfDay(dateStr: string): string {
  const date = new Date(dateStr)
  date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

/**
 * Format date for display in Indonesian locale
 * @param dateStr - ISO date string
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDateDisplay(
  dateStr?: string | Date | null,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  
  if (isNaN(date.getTime())) return '-'
  
  return date.toLocaleDateString('id-ID', options)
}

/**
 * Format time for display in Indonesian locale
 * @param dateStr - ISO date string
 * @returns Formatted time string (HH:mm)
 */
export function formatTimeDisplay(dateStr?: string | Date | null): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  
  if (isNaN(date.getTime())) return '-'
  
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format datetime for display in Indonesian locale
 * @param dateStr - ISO date string
 * @returns Formatted datetime string
 */
export function formatDateTimeDisplay(dateStr?: string | Date | null): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  
  if (isNaN(date.getTime())) return '-'
  
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get day name in Indonesian
 * @param dateStr - ISO date string
 * @returns Day name (e.g., "Senin", "Selasa")
 */
export function getDayName(dateStr?: string | Date | null): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  
  if (isNaN(date.getTime())) return '-'
  
  return date.toLocaleDateString('id-ID', { weekday: 'long' })
}
