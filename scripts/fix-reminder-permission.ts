
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { randomUUID } from 'crypto';

async function main() {
    console.log('🔧 Fixing workorders:reminder permission...');

    // 1. Create/Ensure Permission Exists
    const resource = 'workorders';
    const action = 'reminder';
    
    console.log(`Checking permission: ${resource}:${action}`);
    
    const permission = await prisma.permission.upsert({
        where: {
            resource_action: {
                resource,
                action: action // Should be just 'reminder'
            }
        },
        update: {},
        create: {
            id: randomUUID(),
            updatedAt: new Date(),
            name: 'Reminder Work Orders',
            resource,
            action: action,
            description: 'Send manual reminder notification'
        }
    });
    
    console.log(`✅ Permission ID: ${permission.id}`);

    // 2. Assign to Roles
    const rolesToUpdate = ['SUPER_ADMIN', 'ADMIN'];
    
    for (const roleName of rolesToUpdate) {
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        if (role) {
            await prisma.role.update({
                where: { id: role.id },
                data: {
                    permission: {
                        connect: { id: permission.id }
                    }
                }
            });
            console.log(`✅ Assigned to role: ${roleName}`);
        } else {
            console.warn(`⚠️ Role not found: ${roleName}`);
        }
    }

    // 3. Clear Cache
    console.log('🧹 Clearing Redis cache...');
    const userId = 'c0d56aaf-f48a-47b2-bfc7-ca4c95acacbe'; // Specific user from logs
    const cacheKey = `permissions:${userId}`;
    
    await redis.del(cacheKey);
    console.log(`✅ Cleared specific cache for user: ${userId}`);
    
    // Attempt pattern clear (might fail if keys command blocked, but worth trying for others)
    try {
        const keys = await redis.keys('permissions:*');
        if (keys.length > 0) {
             const pipeline = redis.pipeline();
             keys.forEach(k => pipeline.del(k));
             await pipeline.exec();
             console.log(`✅ Cleared ${keys.length} permission keys.`);
        }
    } catch (e) {
        console.log('⚠️ Could not clear all keys (expected in some envs):', (e as any).message);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        // Redis disconnect might need manual handling if using ioredis directly in script context
        process.exit(0);
    });
