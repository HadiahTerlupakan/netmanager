import { PrismaClient as PrismaClientRadius } from '@prisma/client-radius'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrismaRadius = globalThis as unknown as {
  prismaRadius: PrismaClientRadius | undefined
  prismaRadiusAuth: PrismaClientRadius | undefined
}
const tenantScopedModels = ['radcheck', 'radreply', 'radusergroup', 'radgroupcheck', 'radgroupreply', 'radpostauth', 'radacct', 'radippool', 'nas']

const getRequiredConnectionString = () => {
  const connectionString = process.env.RADIUS_DATABASE_URL
  if (!connectionString) {
    throw new Error('RADIUS_DATABASE_URL is not set in environment variables')
  }
  return connectionString
}

const createRadiusClientBase = () => {
  const pool = new Pool({
    connectionString: getRequiredConnectionString(),
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  const adapter = new PrismaPg(pool)

  return new PrismaClientRadius({
    adapter,
    log: ['error', 'warn'],
  })
}

const createLazyClient = <T extends object>(getClient: () => T): T => new Proxy({} as T, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver)
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getClient() as object, prop, value, receiver)
  },
  has(_target, prop) {
    return Reflect.has(getClient() as object, prop)
  },
  ownKeys() {
    return Reflect.ownKeys(getClient() as object)
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getClient() as object, prop)
  },
})

const getPrismaRadiusAuthClient = () => {
  if (!globalForPrismaRadius.prismaRadiusAuth) {
    globalForPrismaRadius.prismaRadiusAuth = createRadiusClientBase()
  }
  return globalForPrismaRadius.prismaRadiusAuth
}

const getPrismaRadiusClient = () => {
  if (!globalForPrismaRadius.prismaRadius) {
    globalForPrismaRadius.prismaRadius = getPrismaRadiusAuthClient().$extends(withTenantIsolation(tenantScopedModels)) as unknown as PrismaClientRadius
  }
  return globalForPrismaRadius.prismaRadius
}

export const prismaRadius = createLazyClient(() => getPrismaRadiusClient()) as PrismaClientRadius
export const prismaRadiusAuth = createLazyClient(() => getPrismaRadiusAuthClient()) as PrismaClientRadius
