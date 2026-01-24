import { PrismaClient } from '@prisma/client'

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

import 'dotenv/config'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables')
}

// Configure connection pool with limits for memory optimization
const pool = new Pool({
  connectionString,
  max: 20,                    // Maximum pool size
  min: 2,                     // Minimum pool size
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout after 10s
})
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  } as any)

// Fix for BigInt serialization in JSON for React 19
if (typeof BigInt !== 'undefined') {
  // @ts-ignore - Temporary fix for Next.js build
  BigInt.prototype.toJSON = function () {
    return this.toString()
  }
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
