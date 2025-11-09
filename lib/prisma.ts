import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Auto-start scheduler saat aplikasi start (hanya di server-side)
if (typeof window === 'undefined' && !(globalThis as any).__schedulerStarted) {
  // Import dan start scheduler
  import('@/lib/cron/start-scheduler').then(({ startAllSchedulers }) => {
    startAllSchedulers()
    ;(globalThis as any).__schedulerStarted = true
  }).catch((err) => {
    // Ignore error jika terjadi (misalnya saat build time)
    console.warn('[Prisma] Could not start scheduler:', err.message)
  })
}
