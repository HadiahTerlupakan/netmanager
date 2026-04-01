import { PrismaClient } from '@prisma/client-billing'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrismaBilling = globalThis as unknown as { prismaBilling: PrismaClient | undefined }

const connectionString = process.env.DATABASE_URL_BILLING

if (!connectionString) {
  throw new Error('DATABASE_URL_BILLING is not set in environment variables')
}

const pool = new Pool({
  connectionString,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

const adapter = new PrismaPg(pool)

const basePrismaBilling = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

export const prismaBilling = globalForPrismaBilling.prismaBilling ?? 
  (basePrismaBilling.$extends(withTenantIsolation([])) as unknown as PrismaClient)

export const prismaBillingAuth = basePrismaBilling // Un-isolated client for webhooks/discovery

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaBilling.prismaBilling = prismaBilling
}
