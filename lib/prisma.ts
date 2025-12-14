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
