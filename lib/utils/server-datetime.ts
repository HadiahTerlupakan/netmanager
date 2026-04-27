/**
 * Server-only Datetime Utilities
 * Wraps shared datetime utils with dynamic timezone fetching from database.
 * Use this only in Server Components, API Routes, or Services.
 */

import * as sharedDateUtils from "./datetime";
import { getTimezoneSync } from "./get-timezone";

/**
 * Get start of day as Date object (00:00:00.000)
 * Automatically fetches the correct timezone for the current context/tenant if not provided.
 */
export function toStartOfDay(date?: Date | string, timezone?: string): Date {
  const tz = timezone || getTimezoneSync();
  return sharedDateUtils.toStartOfDay(date, tz);
}

/**
 * Get end of day as Date object (23:59:59.999)
 * Automatically fetches the correct timezone for the current context/tenant if not provided.
 */
export function toEndOfDay(date?: Date | string, timezone?: string): Date {
  const tz = timezone || getTimezoneSync();
  return sharedDateUtils.toEndOfDay(date, tz);
}

/** Parse optional server date input and return null for empty or invalid values. */
export function parseOptionalDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

// Re-export other safe utilities
export const {
  formatForDateTimeInput,
  formatForDateInput,
  toISOString,
  getStartOfDay,
  getEndOfDay,
  formatDateDisplay,
  formatTimeDisplay,
  formatDateTimeDisplay,
  getDayName,
  formatDate,
  parseDate,
  isValidDate,
} = sharedDateUtils;
