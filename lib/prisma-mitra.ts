import { PrismaClient } from "@prisma/client-mitra";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLazyPrismaClient } from "./prisma-lazy-client";
import { withTenantIsolation } from "./prisma-extension";
import "dotenv/config";

const globalForPrismaMitra = globalThis as unknown as {
  prismaMitra: PrismaClient | undefined;
  prismaMitraAuth: PrismaClient | undefined;
};

const getRequiredConnectionString = () => {
  const connectionString = process.env.DATABASE_URL_MITRA;
  if (!connectionString) {
    throw new Error("DATABASE_URL_MITRA is not set in environment variables");
  }
  return connectionString;
};

const createPrismaMitraBase = () => {
  const pool = new Pool({
    connectionString: getRequiredConnectionString(),
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
};

const getPrismaMitraAuthClient = () => {
  if (!globalForPrismaMitra.prismaMitraAuth) {
    globalForPrismaMitra.prismaMitraAuth = createPrismaMitraBase();
  }
  return globalForPrismaMitra.prismaMitraAuth;
};

const getPrismaMitraClient = () => {
  if (!globalForPrismaMitra.prismaMitra) {
    globalForPrismaMitra.prismaMitra = getPrismaMitraAuthClient().$extends(
      withTenantIsolation([]),
    ) as unknown as PrismaClient;
  }
  return globalForPrismaMitra.prismaMitra;
};

export const prismaMitraAuth = createLazyPrismaClient(() =>
  getPrismaMitraAuthClient(),
) as PrismaClient;
export const prismaMitra = createLazyPrismaClient(() =>
  getPrismaMitraClient(),
) as PrismaClient;
