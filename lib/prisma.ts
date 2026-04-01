import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

const globalForPrismaAuth = globalThis as unknown as { prismaAuth: PrismaClient | undefined }

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables')
}

const ignoreModels = ['Account', 'Session', 'VerificationToken', 'Tenant']

const createPrismaClientBase = (): PrismaClient => {
  const pool = new Pool({
    connectionString,
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })
}

export const prismaAuth = globalForPrismaAuth.prismaAuth ?? createPrismaClientBase()
export const prisma = globalForPrisma.prisma ?? prismaAuth.$extends(withTenantIsolation(ignoreModels)) as unknown as PrismaClient


if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
