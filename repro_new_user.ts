
import { AttendanceService } from './modules/attendance/services/AttendanceService';
import { prisma } from './lib/prisma';
import { randomUUID } from 'crypto';

async function runTest() {
    console.log('--- Testing New User Scenario ---');

    // 1. Create User with 09:00 schedule
    const userId = randomUUID();
    const email = `test.user.${Date.now()}@example.com`;
    
    console.log(`Creating user ${email} with startWorkTime: '09:00'`);
    
    // Cleanup if exists (unlikely with randomUUID)
    
    const user = await prisma.user.create({
        data: {
            id: userId,
            name: 'Test User 0900',
            email: email,
            startWorkTime: '09:00',
            workingHourMode: 'FIXED', 
            roleId: '8fe42e20-3484-4418-99db-86b325329493',
            updatedAt: new Date()
        }
    });

    try {
        const service = new AttendanceService();

        // 2. Check In at 08:55 (Should be ON_TIME for 09:00)
        // Mock current date to be today at 08:55
        const now = new Date();
        const checkInTime = new Date(now);
        checkInTime.setHours(8, 55, 0, 0); 
        
        console.log(`Simulating CheckIn at: ${checkInTime.toLocaleString()}`);

        const result = await service.checkIn({
            userId: user.id,
            photoUrl: 'http://example.com/photo.jpg',
            location: 'Test Location',
            notes: 'Test CheckIn',
            latitude: -6.200000,
            longitude: 106.816666,
            offlineTime: checkInTime // Use offlineTime to force specific timestamp
        });

        console.log('CheckIn Result:', result);

        if (result.status === 'LATE') {
            console.error('❌ FAILURE: User marked LATE for 08:55 check-in against 09:00 schedule');
        } else {
            console.log('✅ SUCCESS: User marked ON_TIME');
        }

    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        // Cleanup
        await prisma.attendance.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
    }
}

runTest();
