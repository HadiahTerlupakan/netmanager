
import { AttendanceTimezoneService } from './modules/attendance/services/AttendanceTimezoneService';

async function runTest() {
    console.log('--- Testing Timezone Logic Directly ---');
    const service = new AttendanceTimezoneService();
    
    // Test Case 1: 08:55 Check-in, 09:00 Schedule. OK.
    const date1 = new Date();
    date1.setHours(8, 55, 0, 0); // Local time 08:55
    const res1 = await service.calculateStatus(date1, '09:00');
    console.log(`08:55 vs 09:00 -> ${res1} (Expected: ON_TIME)`);

    // Test Case 2: 09:10 Check-in, 09:00 Schedule. OK (15m tolerance).
    const date2 = new Date();
    date2.setHours(9, 10, 0, 0);
    const res2 = await service.calculateStatus(date2, '09:00');
    console.log(`09:10 vs 09:00 -> ${res2} (Expected: ON_TIME)`);

    // Test Case 3: 09:16 Check-in, 09:00 Schedule. LATE.
    const date3 = new Date();
    date3.setHours(9, 16, 0, 0);
    const res3 = await service.calculateStatus(date3, '09:00');
    console.log(`09:16 vs 09:00 -> ${res3} (Expected: LATE)`);

    // Test Case 4: 09:00 EXACTLY.
    const date4 = new Date();
    date4.setHours(9, 0, 0, 0);
    const res4 = await service.calculateStatus(date4, '09:00');
    console.log(`09:00 vs 09:00 -> ${res4} (Expected: ON_TIME)`);
}

runTest();
