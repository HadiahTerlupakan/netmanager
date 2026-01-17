

import 'dotenv/config'
import { redis } from '../lib/redis'


const userId = '034201d4-7cf6-436b-94e9-50965e76ad80'
const PERMISSION_CACHE_PREFIX = 'permissions:'


async function main() {
    console.log('Connecting to Redis...')
    // Wait for connection
    if (redis.status !== 'ready') {
        await new Promise((resolve) => redis.once('ready', resolve))
    }
    console.log(`Connected. Invalidating cache for user ${userId}...`)
    try {
        await redis.del(`${PERMISSION_CACHE_PREFIX}${userId}`)
        console.log('Cache invalidated.')
    } catch (error) {
        console.error('Failed to delete cache:', error)
    } finally {
        redis.disconnect()
    }
}


main().catch(console.error)
