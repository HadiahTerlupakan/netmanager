import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis?: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    enableOfflineQueue: false,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

// Hindari crash/logging bising saat build bila Redis belum siap/NOAUTH
redis.on('error', () => {})

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
) {
  const now = Date.now()
  const bucketKey = `rl:${key}:${Math.floor(now / (windowSeconds * 1000))}`
  try {
    const count = await redis.incr(bucketKey)
    if (count === 1) {
      await redis.expire(bucketKey, windowSeconds)
    }
    return count <= maxAttempts
  } catch {
    // Jika Redis gagal (misconfig/NOAUTH), jangan blokir login
    return true
  }
}


