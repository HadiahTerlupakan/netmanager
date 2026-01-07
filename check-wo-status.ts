
import { prisma } from './lib/prisma';

async function main() {
    // WO ID from the log (WO-0016)
    const workOrderId = '0bae6ae9-003f-4a1f-a8d4-2d2799e22150';

    const wo = await prisma.workOrders.findUnique({
        where: { id: workOrderId },
        select: {
            id: true,
            workOrderNumber: true,
            status: true,
            assignedToId: true,
            departmentId: true,
            siteId: true
        }
    });

    console.log('Work Order Status Check:', wo);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
