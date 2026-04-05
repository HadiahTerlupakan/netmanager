import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis?: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380', {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      // Stop retrying after 3 attempts to avoid log spam
      if (times > 3) return null
      return Math.min(times * 500, 3000)
    },
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
    
    // Progressive delay: semakin banyak percobaan, semakin lama delay
    if (count > maxAttempts) {
      // Calculate delay based on excess attempts
      const excessAttempts = count - maxAttempts
      const delaySeconds = Math.min(excessAttempts * 30, 300) // Max 5 menit delay
      
      // Set a separate key for tracking the delay
      const delayKey = `delay:${safeKey}`
      await redis.setex(delayKey, delaySeconds, '1')
      
      console.log(`Rate limit exceeded for ${safeKey}. Delay: ${delaySeconds}s`)
      return false
    }
    
    return count <= maxAttempts
  } catch (error: unknown) {
    // Jika Redis gagal (misconfig/NOAUTH), jangan blokir request (fail open)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Redis rate limit error:', errorMessage)
    return true
  }
}

/**
 * Check if there's an active delay for a key and return remaining time
 */
export async function checkDelay(key: string): Promise<number> {
  if (!key || typeof key !== 'string' || key.length === 0) {
    return 0
  }

  const safeKey = String(key).trim().replace(/[^a-zA-Z0-9:_-]/g, '_')
  const delayKey = `delay:${safeKey}`

  try {
    const ttl = await redis.ttl(delayKey)
    return ttl > 0 ? ttl : 0
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Redis delay check error:', errorMessage)
    return 0
  }
}
