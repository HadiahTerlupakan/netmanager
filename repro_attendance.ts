
import { strict as assert } from 'assert';

/**
 * Simplified logic from AttendanceTimezoneService.ts
 */
async function calculateStatus(
    checkInTime: Date,
    scheduleTime: string,
    timezone: string,
    toleranceMinutes: number
): Promise<'ON_TIME' | 'LATE'> {
    console.log(`\n--- Testing CheckIn: ${checkInTime.toISOString()} (${timezone}) vs Schedule: ${scheduleTime} (Tol: ${toleranceMinutes}) ---`);

    // 1. Convert checkInTime to the target timezone (simulating service logic)
    const checkInInTzStr = checkInTime.toLocaleString('en-US', { timeZone: timezone });
    const checkInInTz = new Date(checkInInTzStr);
    
    console.log(`checkInLocalString: ${checkInInTzStr}`);
    console.log(`checkInInTz (Date): ${checkInInTz.toString()} [iso: ${checkInInTz.toISOString()}]`);

    // 2. Parse schedule time
    const [schedHour, schedMinute] = scheduleTime.split(':').map(Number);

    // 3. Create schedule date on the SAME DAY as checkInInTz
    const scheduleDate = new Date(checkInInTz);
    scheduleDate.setHours(schedHour, schedMinute, 0, 0);

    console.log(`scheduleDate (Date): ${scheduleDate.toString()} [iso: ${scheduleDate.toISOString()}]`);

    // 4. Calculate late threshold
    const toleranceMs = toleranceMinutes * 60 * 1000;
    const lateThreshold = new Date(scheduleDate.getTime() + toleranceMs);
    
    console.log(`lateThreshold (Date): ${lateThreshold.toString()} [iso: ${lateThreshold.toISOString()}]`);

    const isLate = checkInInTz > lateThreshold;
    console.log(`Result: ${isLate ? 'LATE' : 'ON_TIME'}`);
    
    return isLate ? 'LATE' : 'ON_TIME';
}

async function runTests() {
    // Test Case 1: 08:55 Jakarta (UTC+7) -> expecting ON_TIME for 09:00 schedule
    // 08:55 Jakarta is 01:55 UTC
    const date1 = new Date('2026-01-23T01:55:00Z'); 
    await calculateStatus(date1, '09:00', 'Asia/Jakarta', 15);

    // Test Case 2: 09:10 Jakarta (UTC+7) -> expecting ON_TIME for 09:00 schedule (within 15m tolerance)
    // 09:10 Jakarta is 02:10 UTC
    const date2 = new Date('2026-01-23T02:10:00Z');
    await calculateStatus(date2, '09:00', 'Asia/Jakarta', 15);

    // Test Case 3: 09:16 Jakarta (UTC+7) -> expecting LATE for 09:00 schedule (outside 15m tolerance)
    // 09:16 Jakarta is 02:16 UTC
    const date3 = new Date('2026-01-23T02:16:00Z');
    await calculateStatus(date3, '09:00', 'Asia/Jakarta', 15);

     // Test Case 4: User Report - "Jam 9 kurang" (e.g. 08:59)
     // 08:59 Jakarta is 01:59 UTC
    const date4 = new Date('2026-01-23T01:59:00Z');
    await calculateStatus(date4, '09:00', 'Asia/Jakarta', 15);
}

runTests();
