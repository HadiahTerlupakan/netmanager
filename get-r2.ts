import { prisma } from './lib/prisma';

async function main() {
    const settings = await prisma.settings.findMany({
        where: {
            key: {
                in: [
                    'R2_ACCOUNT_ID',
                    'R2_ACCESS_KEY_ID',
                    'R2_SECRET_ACCESS_KEY',
                    'R2_BUCKET_NAME',
                    'R2_PUBLIC_URL',
                    'R2_ENABLED'
                ]
            }
        }
    });
    console.log(JSON.stringify(settings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
