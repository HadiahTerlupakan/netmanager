import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
export async function GET() {
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
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
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
  } catch (error: any) {
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
  } catch (error: any) {
    // Redis tidak critical, jadi tidak mengubah status overall
    health.services.redis = {
      status: 'unhealthy',
      responseTime: 0,
    }
  }

  // Jika database unhealthy, return 503
  const statusCode = health.status === 'healthy' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}

