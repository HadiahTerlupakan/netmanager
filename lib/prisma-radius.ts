import { PrismaClient as PrismaClientRadius } from "@prisma/client-radius";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLazyPrismaClient } from "./prisma-lazy-client";
import { withTenantIsolation } from "./prisma-extension";
import { RADIUS_ISOLATION_EXEMPT_MODELS } from "./prisma-radius-isolation";
import "dotenv/config";

const globalForPrismaRadius = globalThis as unknown as {
  prismaRadius: PrismaClientRadius | undefined;
  prismaRadiusAuth: PrismaClientRadius | undefined;
};

const getRequiredConnectionString = () => {
  const connectionString = process.env.RADIUS_DATABASE_URL;
  if (!connectionString) {
    throw new Error("RADIUS_DATABASE_URL is not set in environment variables");
  }
  return connectionString;
};

const createRadiusClientBase = () => {
  const pool = new Pool({
    connectionString: getRequiredConnectionString(),
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClientRadius({
    adapter,
    log: ["error", "warn"],
  });
};

const getPrismaRadiusAuthClient = () => {
  if (!globalForPrismaRadius.prismaRadiusAuth) {
    globalForPrismaRadius.prismaRadiusAuth = createRadiusClientBase();
  }
  return globalForPrismaRadius.prismaRadiusAuth;
};

const getPrismaRadiusClient = () => {
  if (!globalForPrismaRadius.prismaRadius) {
    globalForPrismaRadius.prismaRadius = getPrismaRadiusAuthClient().$extends(
      withTenantIsolation(RADIUS_ISOLATION_EXEMPT_MODELS),
    ) as unknown as PrismaClientRadius;
  }
  return globalForPrismaRadius.prismaRadius;
};

export const prismaRadius = createLazyPrismaClient(() =>
  getPrismaRadiusClient(),
) as PrismaClientRadius;
export const prismaRadiusAuth = createLazyPrismaClient(() =>
  getPrismaRadiusAuthClient(),
) as PrismaClientRadius;
