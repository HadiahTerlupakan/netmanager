import { PrismaClient as PrismaClientRadius } from '@prisma/client-radius'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrismaRadius = globalThis as unknown as { prismaRadius: ReturnType<typeof createRadiusPrismaClient> | undefined }

const connectionString = process.env.RADIUS_DATABASE_URL

if (!connectionString) {
  throw new Error('RADIUS_DATABASE_URL is not set in environment variables')
}

const createRadiusPrismaClient = (): PrismaClientRadius => {
  const pool = new Pool({
    connectionString,
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  const adapter = new PrismaPg(pool)

  const baseClient = new PrismaClientRadius({
    adapter,
    log: ['error', 'warn'],
  })

  // Radius models are fully tenant-isolated, nothing to ignore
  return baseClient.$extends(withTenantIsolation([])) as unknown as PrismaClientRadius
}

export const prismaRadius = globalForPrismaRadius.prismaRadius ?? createRadiusPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaRadius.prismaRadius = prismaRadius
}
