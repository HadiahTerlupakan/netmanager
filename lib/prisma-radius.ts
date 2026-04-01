import { PrismaClient as PrismaClientRadius } from '@prisma/client-radius'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrismaRadius = globalThis as unknown as { prismaRadius: PrismaClientRadius | undefined }

const connectionString = process.env.RADIUS_DATABASE_URL

if (!connectionString) {
  throw new Error('RADIUS_DATABASE_URL is not set in environment variables')
}

const pool = new Pool({
  connectionString,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

const adapter = new PrismaPg(pool)

const baseRadiusClient = new PrismaClientRadius({
  adapter,
  log: ['error', 'warn'],
})

export const prismaRadius = globalForPrismaRadius.prismaRadius ?? 
  (baseRadiusClient.$extends(withTenantIsolation(['radcheck', 'radreply', 'radusergroup', 'radgroupcheck', 'radgroupreply', 'radpostauth', 'radacct', 'radippool', 'nas'])) as unknown as PrismaClientRadius)

export const prismaRadiusAuth = baseRadiusClient

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaRadius.prismaRadius = prismaRadius
}
