const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const workOrders = await prisma.workOrder.findMany({
        where: {
            type: 'TROUBLESHOOT'
        },
        take: 20,
        select: {
            title: true,
            description: true
        }
    });
    console.log('Sample Troubleshoot Titles:', workOrders.map(w => w.title));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
