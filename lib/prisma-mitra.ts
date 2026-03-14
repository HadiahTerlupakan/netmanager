import { PrismaClient } from '@/prisma/generated/mitra'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { withTenantIsolation } from './prisma-extension'
import 'dotenv/config'

const globalForPrismaMitra = globalThis as unknown as { prismaMitra: ReturnType<typeof createPrismaMitraClient> | undefined }

const connectionString = process.env.DATABASE_URL_MITRA

if (!connectionString) {
    throw new Error('DATABASE_URL_MITRA is not set in environment variables')
}

const createPrismaMitraClient = () => {
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

    // Mitra models are fully tenant-isolated
    return baseClient.$extends(withTenantIsolation([])) as unknown as PrismaClient
}

export const prismaMitra = globalForPrismaMitra.prismaMitra ?? createPrismaMitraClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrismaMitra.prismaMitra = prismaMitra
}
