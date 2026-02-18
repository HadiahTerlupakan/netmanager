/**
 * Datetime Utilities
 * Timezone-safe date formatting for forms and API communication
 * Now using date-fns for consistent date handling
 */

import {
  startOfDay as dateFnsStartOfDay,
  endOfDay as dateFnsEndOfDay,
  format as dateFnsFormat,
  isValid,
  parseISO,
} from 'date-fns'
import { id as localeId } from 'date-fns/locale'

/**
 * Format a date string or Date object for datetime-local input
 * Handles timezone correctly without manual offset calculations
 * @param dateStr - ISO date string or Date object
 * @returns String formatted for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export function formatForDateTimeInput(dateStr?: string | Date | null): string {
  if (!dateStr) return ''
  
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  
  if (!isValid(date)) return ''
  
  return dateFnsFormat(date, "yyyy-MM-dd'T'HH:mm")
}

/**
 * Format a date string for date input (YYYY-MM-DD)
 * @param dateStr - ISO date string or Date object
 * @returns String formatted for date input
 */
export function formatForDateInput(dateStr?: string | Date | null): string {
  if (!dateStr) return ''
  
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  
  if (!isValid(date)) return ''
  
  return dateFnsFormat(date, 'yyyy-MM-dd')
}

/**
 * Convert datetime-local input value to ISO string for API
 * @param datetimeLocalValue - Value from datetime-local input
 * @returns ISO string or null
 */
export function toISOString(datetimeLocalValue?: string | null): string | null {
  if (!datetimeLocalValue) return null
  
  const date = parseISO(datetimeLocalValue)
  
  if (!isValid(date)) return null
  
  return date.toISOString()
}

/**
 * Get start of day for a date (00:00:00.000)
 * @param dateStr - Date string (YYYY-MM-DD format)
 * @returns ISO string for start of day
 */
export function getStartOfDay(dateStr: string): string {
  const date = parseISO(dateStr)
  return dateFnsStartOfDay(date).toISOString()
}

/**
 * Get end of day for a date (23:59:59.999)
 * @param dateStr - Date string (YYYY-MM-DD format)
 * @returns ISO string for end of day
 */
export function getEndOfDay(dateStr: string): string {
  const date = parseISO(dateStr)
  return dateFnsEndOfDay(date).toISOString()
}

/**
 * Format date for display in Indonesian locale
 * @param dateStr - ISO date string
 * @param formatStr - date-fns format string (default: 'd MMM yyyy')
 * @returns Formatted date string
 */
export function formatDateDisplay(
  dateStr?: string | Date | null,
  formatStr: string = 'd MMM yyyy'
): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  
  if (!isValid(date)) return '-'
  
  return dateFnsFormat(date, formatStr, { locale: localeId })
}

/**
 * Format time for display in Indonesian locale
 * @param dateStr - ISO date string
 * @returns Formatted time string (HH:mm)
 */
export function formatTimeDisplay(dateStr?: string | Date | null): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  
  if (!isValid(date)) return '-'
  
  return dateFnsFormat(date, 'HH:mm', { locale: localeId })
}

/**
 * Format datetime for display in Indonesian locale
 * @param dateStr - ISO date string
 * @returns Formatted datetime string
 */
export function formatDateTimeDisplay(dateStr?: string | Date | null): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  
  if (!isValid(date)) return '-'
  
  return dateFnsFormat(date, 'd MMM yyyy HH:mm', { locale: localeId })
}

/**
 * Get day name in Indonesian
 * @param dateStr - ISO date string
 * @returns Day name (e.g., "Senin", "Selasa")
 */
export function getDayName(dateStr?: string | Date | null): string {
  if (!dateStr) return '-'
  
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  
  if (!isValid(date)) return '-'
  
  return dateFnsFormat(date, 'EEEE', { locale: localeId })
}

/**
 * Format date with custom format string
 * @param dateStr - ISO date string or Date object
 * @param formatStr - date-fns format string
 * @returns Formatted date string
 */
export function formatDate(
  dateStr: string | Date,
  formatStr: string
): string {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  
  if (!isValid(date)) return '-'
  
  return dateFnsFormat(date, formatStr, { locale: localeId })
}

/**
 * Parse a date string to Date object
 * @param dateStr - ISO date string
 * @returns Date object or null if invalid
 */
export function parseDate(dateStr: string): Date | null {
  const date = parseISO(dateStr)
  return isValid(date) ? date : null
}

/**
 * Check if a date is valid
 * @param dateStr - ISO date string or Date object
 * @returns boolean
 */
export function isValidDate(dateStr: string | Date | null | undefined): boolean {
  if (!dateStr) return false
  
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  return isValid(date)
}
