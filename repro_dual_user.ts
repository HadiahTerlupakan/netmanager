
import { AttendanceService } from './modules/attendance/services/AttendanceService';
import { prisma } from './lib/prisma';
import { randomUUID } from 'crypto';

async function runDualUserTest() {
    console.log('--- Testing Dual User Scenario (08:00 vs 09:00) ---');

    const service = new AttendanceService();
    const roleId = '8fe42e20-3484-4418-99db-86b325329493'; // Valid role
    const now = new Date(); // Base time

    // --- USER A: 08:00 Schedule ---
    const userAId = randomUUID();
    console.log(`\n1. Creating User A (08:00)...`);
    await prisma.user.create({
        data: {
            id: userAId,
            email: `userA.${Date.now()}@test.com`,
            name: 'User A (08:00)',
            startWorkTime: '08:00',
            workingHourMode: 'FIXED',
            roleId,
            updatedAt: new Date()
        }
    });

    // Simulate CheckIn at 07:55
    const checkInA = new Date(now);
    checkInA.setHours(7, 55, 0, 0); 
    console.log(`User A Checking In at: ${checkInA.toLocaleTimeString('en-US', {hour12: false})}`);
    
    // Use offlineTime to force time
    const resultA = await service.checkIn({
        userId: userAId,
        photoUrl: 'photoA.jpg',
        location: 'LocA',
        notes: 'CheckIn A',
        latitude: -6.2, longitude: 106.8,
        offlineTime: checkInA
    });
    console.log(`User A Result: ${resultA.status} (Expected: ON_TIME)`);


    // --- USER B: 09:00 Schedule ---
    const userBId = randomUUID();
    console.log(`\n2. Creating User B (09:00)...`);
    await prisma.user.create({
        data: {
            id: userBId,
            email: `userB.${Date.now()}@test.com`,
            name: 'User B (09:00)',
            startWorkTime: '09:00',
            workingHourMode: 'FIXED',
            roleId,
            updatedAt: new Date()
        }
    });

    // Simulate CheckIn at 08:55
    const checkInB = new Date(now);
    checkInB.setHours(8, 55, 0, 0);
    console.log(`User B Checking In at: ${checkInB.toLocaleTimeString('en-US', {hour12: false})}`);

    const resultB = await service.checkIn({
        userId: userBId,
        photoUrl: 'photoB.jpg',
        location: 'LocB',
        notes: 'CheckIn B',
        latitude: -6.2, longitude: 106.8,
        offlineTime: checkInB
    });
    console.log(`User B Result: ${resultB.status} (Expected: ON_TIME)`);

    // --- Cleanup ---
    await prisma.attendance.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
}

runDualUserTest();
