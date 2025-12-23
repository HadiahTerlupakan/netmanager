
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        take: 20,
        select: {
            id: true,
            name: true,
            email: true,
            startWorkTime: true,
            endWorkTime: true,
            workingHourMode: true,
        }
    });

    console.log("Users:", JSON.stringify(users, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
