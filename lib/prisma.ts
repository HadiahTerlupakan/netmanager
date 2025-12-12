import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

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

// Auto-start scheduler saat aplikasi start (hanya di server-side)
// Skip scheduler untuk test environment
if (
  typeof window === 'undefined' &&
  !(globalThis as any).__schedulerStarted &&
  process.env.NODE_ENV !== 'test' &&
  !process.env.VITEST &&
  !process.env.NEXT_PHASE &&
  process.env.NEXT_PHASE !== 'phase-production-build' &&
  process.env.NEXT_PHASE !== 'phase-production-build-server'
) {
  // Import dan start scheduler
  import('@/lib/cron/start-scheduler').then(({ startAllSchedulers }) => {
    startAllSchedulers()
      ; (globalThis as any).__schedulerStarted = true
  }).catch((err) => {
    // Ignore error jika terjadi (misalnya saat build time)
    console.warn('[Prisma] Could not start scheduler:', err.message)
  })
}
