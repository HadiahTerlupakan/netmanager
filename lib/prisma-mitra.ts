import { PrismaClient } from '@/prisma/generated/mitra'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrismaMitra = globalThis as unknown as { 
    prismaMitra: PrismaClient | undefined,
    prismaMitraAuth: PrismaClient | undefined 
}

const connectionString = process.env.DATABASE_URL_MITRA

if (!connectionString) {
    throw new Error('DATABASE_URL_MITRA is not set in environment variables')
}

const createPrismaMitraClientBase = (): PrismaClient => {
    const pool = new Pool({
        connectionString,
        max: 20,
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

export const prismaMitraAuth = globalForPrismaMitra.prismaMitraAuth ?? createPrismaMitraClientBase()
export const prismaMitra = globalForPrismaMitra.prismaMitra ?? prismaMitraAuth.$extends(withTenantIsolation([])) as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') {
    globalForPrismaMitra.prismaMitra = prismaMitra
    globalForPrismaMitra.prismaMitraAuth = prismaMitraAuth
}
