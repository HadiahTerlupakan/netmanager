import { PrismaClient } from '@prisma/client-radius'

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

import 'dotenv/config'

const globalForPrismaRadius = globalThis as unknown as { prismaRadius?: PrismaClient }

const connectionString = process.env.RADIUS_DATABASE_URL

if (!connectionString) {
  throw new Error('RADIUS_DATABASE_URL is not set in environment variables')
}

const pool = new Pool({
  connectionString,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

const adapter = new PrismaPg(pool)

export const prismaRadius =
  globalForPrismaRadius.prismaRadius ??
  new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaRadius.prismaRadius = prismaRadius
}
