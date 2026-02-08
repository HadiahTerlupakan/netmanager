
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { getUserPermissions } from './lib/auth';

const PERMISSION_CACHE_PREFIX = 'permissions:';

async function main() {
  console.log('--- Debugging Super Admin Permissions ---');

  // 1. Find a user with a Super Admin role
  const user = await prisma.user.findFirst({
    where: {
      role: {
        isSuperAdmin: true
      }
    },
    include: { role: true }
  });

  if (!user) {
    console.log('No user found with isSuperAdmin role.');
    return;
  }

  console.log(`Found Super Admin User: ${user.email} (${user.id})`);
  console.log(`Role: ${user.role?.name}, isSuperAdmin: ${user.role?.isSuperAdmin}`);

  // 2. Check Redis Cache
  const cacheKey = `${PERMISSION_CACHE_PREFIX}${user.id}`;
  const cached = await redis.get(cacheKey);
  console.log(`Redis Cache (${cacheKey}):`, cached);

  // 3. Clear Cache
  console.log('Clearing Redis cache...');
  await redis.del(cacheKey);

  // 4. Fetch Permissions (should hit DB and return ['*'])
  console.log('Fetching permissions via getUserPermissions...');
  const permissions = await getUserPermissions(user.id);
  console.log('Permissions returned:', permissions);

  if (permissions.includes('*')) {
    console.log('SUCCESS: Wildcard permission found!');
  } else {
    console.error('FAILURE: Wildcard permission MISSING!');
  }
}

main();
