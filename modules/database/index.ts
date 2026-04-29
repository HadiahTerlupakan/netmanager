/** Provides shared database clients through the database module boundary. */
export { prisma, prismaAuth } from "@/lib/prisma";
export { prismaMitra, prismaMitraAuth } from "@/lib/prisma-mitra";
export { prismaBilling, prismaBillingAuth } from "@/lib/prisma-billing";
export { prismaRadius, prismaRadiusAuth } from "@/lib/prisma-radius";
export * from "@/lib/prisma-errors";
