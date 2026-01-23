
import { UserService } from './modules/users/services/UserService';
import { cache } from './lib/cache';
import { randomUUID } from 'crypto';
import { prisma } from './lib/prisma';
import { WorkingHourMode } from '@prisma/client';

async function verifyCacheInvalidation() {
    console.log('--- Verifying Cache Invalidation ---');

    // 1. Setup User
    const userId = randomUUID();
    const email = `test.cache.${Date.now()}@example.com`;
    const roleId = '8fe42e20-3484-4418-99db-86b325329493'; // Valid role
    
    await prisma.user.create({
        data: {
            id: userId,
            email,
            name: 'Cache Test User',
            passwordHash: 'hash',
            roleId,
            startWorkTime: '08:00',
            workingHourMode: 'FIXED',
            updatedAt: new Date()
        }
    });

    try {
        // 2. Prime Cache (Simulate AttendanceService behavior)
        const cacheKey = `user:schedule:${userId}`;
        cache.set(cacheKey, { startWorkTime: '08:00' }, 60); // 60s TTL
        console.log('Cache Primed:', cache.get(cacheKey)); // Should exist

        // 3. Update Working Hours via UserService
        const userService = new UserService();
        await userService.updateWorkingHours(userId, {
            workingHourMode: WorkingHourMode.FIXED,
            startWorkTime: '09:00',
            endWorkTime: '17:00',
            workDays: 'MON,TUE'
        });
        console.log('Working Hours Updated to 09:00');

        // 4. Assert Cache Cleared
        const cachedValue = cache.get(cacheKey);
        if (cachedValue === null) {
            console.log('✅ SUCCESS: Cache was invalidated.');
        } else {
            console.error('❌ FAILURE: Cache still exists:', cachedValue);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.user.delete({ where: { id: userId } });
    }
}

verifyCacheInvalidation();
