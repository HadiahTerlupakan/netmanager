/**
 * Database Module - Public API
 * 
 * Provides typed database client access for API routes.
 * All direct Prisma access should go through this module
 * instead of importing from @/lib/prisma or @/lib/prisma-mitra.
 */
export { prisma, prismaAuth } from '@/lib/prisma'
export { prismaMitra, prismaMitraAuth } from '@/lib/prisma-mitra'
export { prismaBilling, prismaBillingAuth } from '@/lib/prisma-billing'
export * from '@/lib/prisma-errors'
