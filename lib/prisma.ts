import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLazyPrismaClient } from "./prisma-lazy-client";
import { withTenantIsolation } from "./prisma-extension";
import "dotenv/config";

const globalForPrismaAuth = globalThis as unknown as {
  prismaAuth: PrismaClient | undefined;
};
const ignoreModels = [
  "Account",
  "Session",
  "VerificationToken",
  "Tenant",
  "SystemLog",
];

let prismaClient: PrismaClient | undefined;

const getRequiredConnectionString = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }
  return connectionString;
};

const createPrismaClientBase = (): PrismaClient => {
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

const getPrismaAuthClient = () => {
  if (!globalForPrismaAuth.prismaAuth) {
    globalForPrismaAuth.prismaAuth = createPrismaClientBase();
  }
  return globalForPrismaAuth.prismaAuth;
};

const getPrismaClient = () => {
  if (!prismaClient) {
    prismaClient = getPrismaAuthClient().$extends(
      withTenantIsolation(ignoreModels),
    ) as unknown as PrismaClient;
  }
  return prismaClient;
};

export const prismaAuth = createLazyPrismaClient(() =>
  getPrismaAuthClient(),
) as PrismaClient;
export const prisma = createLazyPrismaClient(() =>
  getPrismaClient(),
) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  void globalForPrismaAuth;
}
