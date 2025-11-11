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
  // Validasi input
  if (!key || typeof key !== 'string' || key.length === 0) {
    return true // Skip rate limiting jika key tidak valid
  }

  // Pastikan key aman (tidak mengandung karakter berbahaya)
  const safeKey = String(key).trim().replace(/[^a-zA-Z0-9:_-]/g, '_')
  if (!safeKey || safeKey.length === 0) {
    return true
  }

  const now = Date.now()
  const bucketKey = `rl:${safeKey}:${Math.floor(now / (windowSeconds * 1000))}`
  
  try {
    const count = await redis.incr(bucketKey)
    if (count === 1) {
      await redis.expire(bucketKey, windowSeconds)
    }
    return count <= maxAttempts
  } catch (error: any) {
    // Jika Redis gagal (misconfig/NOAUTH), jangan blokir request (fail open)
    console.error('Redis rate limit error:', error?.message || error)
    return true
  }
}


