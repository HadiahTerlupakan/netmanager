const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const wo = await prisma.workOrder.findFirst({
        where: {
            assignments: {
                some: {}
            }
        },
        include: {
            assignments: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        }
    });

    console.log(JSON.stringify(wo, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
