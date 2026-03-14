import { PrismaClient } from '@/prisma/generated/billing'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrismaBilling = globalThis as unknown as { prismaBilling: ReturnType<typeof createPrismaBillingClient> | undefined }

const connectionString = process.env.DATABASE_URL_BILLING

if (!connectionString) {
  throw new Error('DATABASE_URL_BILLING is not set in environment variables')
}

const createPrismaBillingClient = () => {
  // Configure connection pool with limits for memory optimization
  const pool = new Pool({
    connectionString,
    max: 20,                    // Maximum pool size
    min: 2,                     // Minimum pool size
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Timeout after 10s
  })

  const adapter = new PrismaPg(pool)

  const baseClient = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })

  // Billing models are fully tenant-isolated
  return baseClient.$extends(withTenantIsolation([])) as unknown as PrismaClient
}

export const prismaBilling = globalForPrismaBilling.prismaBilling ?? createPrismaBillingClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaBilling.prismaBilling = prismaBilling
}
