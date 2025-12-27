
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const woNumber = 'WO-TEST-1766667826652';
    console.log(`Searching for WO: ${woNumber}`);

    const workOrder = await prisma.workOrders.findUnique({
        where: { workOrderNumber: woNumber },
        include: {
            assignedTo: true
        }
    });

    if (!workOrder) {
        console.log('Work Order not found!');
        return;
    }

    console.log('Found Work Order:', workOrder.id);
    console.log('Status:', workOrder.status);

    if (!workOrder.assignedTo) {
        console.log('NO ASSIGNED USER');
    } else {
        console.log('Assigned To:', workOrder.assignedTo.name);
        console.log('Assigned To ID:', workOrder.assignedTo.id);
        console.log('Push Token:', workOrder.assignedTo.pushToken);
        console.log('Is Active:', workOrder.assignedTo.isActive);
    }

    // Also check who is "System Administrator" to see if it matches
    const admin = await prisma.user.findFirst({
        where: { name: 'System Administrator' }
    });

    if (admin) {
        console.log('---');
        console.log('System Administrator ID:', admin.id);
        if (workOrder.assignedTo?.id === admin.id) {
            console.log('WARNING: Assigned User IS System Administrator. Self-notifications are blocked in the code.');
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
