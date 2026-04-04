import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api-response'
import { prisma } from '@/modules/database'
import { redis } from '@/lib/redis'

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Mengecek status aplikasi, database, dan Redis. Berguna untuk monitoring dan load balancer health checks.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Aplikasi sehat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 *       503:
 *         description: Aplikasi tidak sehat (database down)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 */
export async function GET(request: NextRequest) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: 'unknown',
        responseTime: 0,
      },
      redis: {
        status: 'unknown',
        responseTime: 0,
      },
    },
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      heapUsedPercentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
      unit: 'MB',
    },
  }

  // Check Database Connection
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbTime = Date.now() - dbStart
    
    health.services.database = {
      status: 'healthy',
      responseTime: dbTime,
    }
  } catch (_error) {
    health.status = 'unhealthy'
    health.services.database = {
      status: 'unhealthy',
      responseTime: 0,
    }
  }

  // Check Redis Connection
  try {
    const redisStart = Date.now()
    await redis.ping()
    const redisTime = Date.now() - redisStart

    health.services.redis = {
      status: 'healthy',
      responseTime: redisTime,
    }
  } catch (_error) {
    // Redis tidak critical, jadi tidak mengubah status overall
    health.services.redis = {
      status: 'unhealthy',
      responseTime: 0,
    }
  }

  // Jika database unhealthy, return 503
  const statusCode = health.status === 'healthy' ? 200 : 503

  // Check if this is an internal request with valid secret
  const internalSecret = request.headers.get('x-internal-request')
  const expectedSecret = process.env.INTERNAL_HEALTH_SECRET

  if (expectedSecret && internalSecret === expectedSecret) {
    // Authenticated internal request: return full details
    return apiSuccess(health, { status: statusCode })
  }

  // Public request: return minimal status only
  return apiSuccess(
    { status: health.status === 'healthy' ? 'ok' : 'error', timestamp: new Date().toISOString() },
    { status: statusCode }
  )
}

