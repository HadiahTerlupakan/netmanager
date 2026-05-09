/**
 * workDays Format Validator
 *
 * Validates workDays string to ensure:
 * 1. Only accepts one of 4 supported formats (Short English, Full English, Indonesian, Numeric)
 * 2. No duplicates
 * 3. No empty string
 * 4. At least 1 working day
 * 5. Maximum 7 working days
 * 6. Consistent format (no mixing)
 */

import * as z from "zod";

// Supported day formats
const SHORT_ENGLISH_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_ENGLISH_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const INDONESIAN_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const NUMERIC_DAYS = ["0", "1", "2", "3", "4", "5", "6"];

type DayFormat = "short-english" | "full-english" | "indonesian" | "numeric";

/**
 * Detect which format is used in the workDays string
 */
function detectFormat(days: string[]): DayFormat | null {
  if (days.every((d) => SHORT_ENGLISH_DAYS.includes(d))) return "short-english";
  if (days.every((d) => FULL_ENGLISH_DAYS.includes(d))) return "full-english";
  if (days.every((d) => INDONESIAN_DAYS.includes(d))) return "indonesian";
  if (days.every((d) => NUMERIC_DAYS.includes(d))) return "numeric";
  return null;
}

/**
 * Validate workDays string format
 */
function validateWorkDays(value: string): boolean {
  // Check: not empty after trim
  if (!value || value.trim().length === 0) {
    throw new Error("workDays tidak boleh kosong");
  }

  // Split and trim
  const days = value
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  // Check: at least 1 day
  if (days.length === 0) {
    throw new Error("workDays harus memiliki minimal 1 hari kerja");
  }

  // Check: maximum 7 days
  if (days.length > 7) {
    throw new Error("workDays tidak boleh lebih dari 7 hari");
  }

  // Check: no duplicates
  const uniqueDays = new Set(days);
  if (uniqueDays.size !== days.length) {
    throw new Error("workDays tidak boleh memiliki hari yang duplikat");
  }

  // Check: consistent format
  const format = detectFormat(days);
  if (!format) {
    throw new Error(
      "Format workDays tidak valid. Gunakan salah satu format: " +
        "Short English (Mon,Tue,Wed), Full English (Monday,Tuesday), " +
        "Indonesian (Senin,Selasa), atau Numeric (1,2,3)",
    );
  }

  return true;
}

/**
 * Zod schema for workDays validation
 */
export const workDaysSchema = z
  .string()
  .min(1, "workDays tidak boleh kosong")
  .refine(
    (value) => {
      try {
        return validateWorkDays(value);
      } catch (_error) {
        return false;
      }
    },
    {
      message: "Format workDays tidak valid",
    },
  );

/**
 * Optional workDays schema (for updates)
 */
export const workDaysOptionalSchema = z
  .string()
  .min(1, "workDays tidak boleh kosong")
  .refine(
    (value) => {
      try {
        return validateWorkDays(value);
      } catch (_error) {
        return false;
      }
    },
    {
      message: "Format workDays tidak valid",
    },
  )
  .optional();

/**
 * Export validation function for use in other modules
 */
export { validateWorkDays, detectFormat };
