import { prisma } from './lib/prisma';

async function test() {
    try {
        const users = await prisma.user.findMany({ take: 1 });
        console.log('Successfully fetched users:', users.length);
    } catch (err) {
        console.error('Failed to fetch users:', err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
