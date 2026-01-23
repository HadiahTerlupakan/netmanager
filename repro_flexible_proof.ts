
import { AutoCheckoutService } from './modules/attendance/services/AutoCheckoutService';
import { prisma } from './lib/prisma';
import { randomUUID } from 'crypto';

async function runProof() {
    console.log('--- Proving NO Auto-Checkout for Flexible Users ---');
    const now = new Date();
    // Create Yesterday date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(8, 0, 0, 0);

    const roleId = '8fe42e20-3484-4418-99db-86b325329493'; 

    // 1. Create Flexible User
    const flexId = randomUUID();
    console.log('Creating Flexible User...');
    await prisma.user.create({
        data: {
            id: flexId,
            name: 'Flexible User Proof',
            email: `flex.${Date.now()}@proof.com`,
            startWorkTime: null,
            workingHourMode: 'FLEXIBLE',
            roleId,
            updatedAt: new Date()
        }
    });

    // 2. Create Open Attendance for Flexible User (Yesterday)
    const flexAttId = randomUUID();
    await prisma.attendance.create({
        data: {
            id: flexAttId,
            userId: flexId,
            checkIn: yesterday, // Old checkin
            checkOut: null, // Still open
            status: 'ON_TIME',
            updatedAt: new Date()
        }
    });

    // 3. Create Fixed User (Control Group)
    const fixedId = randomUUID();
    console.log('Creating Fixed User (Control)...');
    await prisma.user.create({
        data: {
            id: fixedId,
            name: 'Fixed User Control',
            email: `fixed.${Date.now()}@proof.com`,
            startWorkTime: '08:00',
            workingHourMode: 'FIXED',
            roleId,
            updatedAt: new Date()
        }
    });

    // 4. Create Open Attendance for Fixed User (Yesterday)
    const fixedAttId = randomUUID();
    await prisma.attendance.create({
        data: {
            id: fixedAttId,
            userId: fixedId,
            checkIn: yesterday,
            checkOut: null,
            status: 'ON_TIME',
            updatedAt: new Date()
        }
    });

    // 5. RUN AUTO CHECKOUT
    console.log('\n>>> Running AutoCheckoutService.runAutoCheckout() <<<\n');
    await AutoCheckoutService.runAutoCheckout();

    // 6. Verify Results
    const flexResult = await prisma.attendance.findUnique({ where: { id: flexAttId } });
    const fixedResult = await prisma.attendance.findUnique({ where: { id: fixedAttId } });

    console.log('\n--- Results ---');
    if (flexResult?.checkOut === null) {
        console.log('✅ FLEXIBLE User: Still Checked In (CheckOut is null). PROOF SUCCESS.');
    } else {
        console.error('❌ FLEXIBLE User: Was Checked Out! (FAIL)', flexResult?.checkOut);
    }

    if (fixedResult?.checkOut !== null) {
        console.log('✅ FIXED User: Was Checked Out (Expected for Fixed).');
    } else {
        console.error('❌ FIXED User: Was NOT Checked Out! (Logic broken?)');
    }

    // Cleanup
    await prisma.attendance.deleteMany({ where: { userId: { in: [flexId, fixedId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [flexId, fixedId] } } });
}

runProof();
