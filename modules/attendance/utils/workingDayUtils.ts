/**
 * Shared utility for working day / off-day detection.
 * Handles all known workDays formats:
 *   - Short English: "Mon,Tue,Wed,Thu,Fri"
 *   - Full English:  "Monday,Tuesday,Wednesday,Thursday,Friday"
 *   - Indonesian:    "Senin,Selasa,Rabu,Kamis,Jumat"
 *   - Numeric:       "1,2,3,4,5"
 *
 * Used by:
 *   - status/route.ts
 *   - history/route.ts
 *   - AttendanceValidationService.ts
 */

/** Maps every known day-name variant to its JS getDay() numeric value (0=Sun … 6=Sat) */
export const dayNameToNumber: Record<string, number> = {
    // Short English
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
    // Full English
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6,
    // Indonesian
    'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6,
    // Numeric strings
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
}

/**
 * Parse a comma-separated workDays string into an array of JS day numbers.
 * Returns empty array for null/undefined/empty input.
 */
export function parseWorkDaysToNumbers(workDays: string | null | undefined): number[] {
    if (!workDays) return []
    return workDays
        .split(',')
        .map(d => {
            const trimmed = d.trim()
            const parsed = parseInt(trimmed)
            if (!isNaN(parsed)) return parsed
            return dayNameToNumber[trimmed]
        })
        .filter((d): d is number => d !== undefined)
}

/**
 * Determine whether a given day-of-week is an off-day for the user.
 *
 * @param dayOfWeek   JS getDay() value (0=Sun … 6=Sat)
 * @param workDays    Raw workDays string from User record (nullable)
 * @param workingHourMode  The user's working hour mode (nullable)
 * @returns true if the day is an off-day (user should NOT work)
 */
export function isOffDayForUser(
    dayOfWeek: number,
    workDays: string | null | undefined,
    workingHourMode: string | null | undefined
): boolean {
    // FLEXIBLE users have no fixed schedule — never an off-day
    if (workingHourMode === 'FLEXIBLE') return false

    const workDayNumbers = parseWorkDaysToNumbers(workDays)

    // SAFEGUARD: If workDays is empty after parsing, don't block the user
    if (workDayNumbers.length === 0) return false

    return !workDayNumbers.includes(dayOfWeek)
}
