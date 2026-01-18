
import { redis } from '../lib/redis';

async function main() {
    console.log('🧹 Clearing permission cache...');
    
    // Get all keys starting with permissions:
    const keys = await redis.keys('permissions:*');
    
    if (keys.length > 0) {
        console.log(`Found ${keys.length} cached permission keys.`);
        const pipeline = redis.pipeline();
        keys.forEach(key => pipeline.del(key));
        await pipeline.exec();
        console.log('✅ Successfully cleared permission cache.');
    } else {
        console.log('ℹ️ No cached permissions found.');
    }
    
    // Also clear specific user cache if needed (though keys search should cover it)
    // The specific user from logs is c0d56aaf-f48a-47b2-bfc7-ca4c95acacbe
    const userKey = 'permissions:c0d56aaf-f48a-47b2-bfc7-ca4c95acacbe';
    const activeUserCached = await redis.get(userKey);
    if (activeUserCached) {
         console.log('Warning: Active user cache was persistent, strictly deleting it now.');
         await redis.del(userKey);
    }
}

main()
    .catch(console.error)
    .finally(() => {
        process.exit(0);
    });
