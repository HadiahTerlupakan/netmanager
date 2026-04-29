import { PrismaClient } from "@prisma/client-billing";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLazyPrismaClient } from "./prisma-lazy-client";
import { withTenantIsolation } from "./prisma-extension";
import "dotenv/config";

const globalForPrismaBilling = globalThis as unknown as {
  prismaBilling: PrismaClient | undefined;
  prismaBillingAuth: PrismaClient | undefined;
};

const getRequiredConnectionString = () => {
  const connectionString = process.env.DATABASE_URL_BILLING;
  if (!connectionString) {
    throw new Error("DATABASE_URL_BILLING is not set in environment variables");
  }
  return connectionString;
};

const createPrismaBillingBase = () => {
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

const getPrismaBillingAuthClient = () => {
  if (!globalForPrismaBilling.prismaBillingAuth) {
    globalForPrismaBilling.prismaBillingAuth = createPrismaBillingBase();
  }
  return globalForPrismaBilling.prismaBillingAuth;
};

const getPrismaBillingClient = () => {
  if (!globalForPrismaBilling.prismaBilling) {
    globalForPrismaBilling.prismaBilling =
      getPrismaBillingAuthClient().$extends(
        withTenantIsolation([]),
      ) as unknown as PrismaClient;
  }
  return globalForPrismaBilling.prismaBilling;
};

export const prismaBilling = createLazyPrismaClient(() =>
  getPrismaBillingClient(),
) as PrismaClient;
export const prismaBillingAuth = createLazyPrismaClient(() =>
  getPrismaBillingAuthClient(),
) as PrismaClient;
