
import { prisma } from './lib/prisma';
import { TargetAudience } from '@prisma/client';

async function main() {
    console.log('--- Debugging Employee Announcements ---');
    const now = new Date();
    console.log('Current Server Time:', now.toISOString());

    const employeeWhere = {
        target: { in: [TargetAudience.ALL, TargetAudience.EMPLOYEE] },
        isActive: true,
        startDate: { lte: now },
        OR: [
            { endDate: null },
            { endDate: { gte: now } }
        ]
    };

    console.log('Querying with:', JSON.stringify(employeeWhere, null, 2));

    const announcements = await prisma.announcement.findMany({
        where: employeeWhere
    });

    console.log(`Found ${announcements.length} matching announcements for EMPLOYEES:`);
    console.log(JSON.stringify(announcements, null, 2));

    console.log('--- All Announcements ---');
    const all = await prisma.announcement.findMany();
    console.log(JSON.stringify(all, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
