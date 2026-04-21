import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { withTenantIsolation } from "./prisma-extension";
import "dotenv/config";

const globalForPrismaAuth = globalThis as unknown as {
  prismaAuth: PrismaClient | undefined;
};
const ignoreModels = ["Account", "Session", "VerificationToken", "Tenant"];

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

const createLazyClient = <T extends object>(getClient: () => T): T =>
  new Proxy({} as T, {
    get(_target, prop, receiver) {
      return Reflect.get(getClient() as object, prop, receiver);
    },
    set(_target, prop, value, receiver) {
      return Reflect.set(getClient() as object, prop, value, receiver);
    },
    has(_target, prop) {
      return Reflect.has(getClient() as object, prop);
    },
    ownKeys() {
      return Reflect.ownKeys(getClient() as object);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(getClient() as object, prop);
    },
  });

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

export const prismaAuth = createLazyClient(() =>
  getPrismaAuthClient(),
) as PrismaClient;
export const prisma = createLazyClient(() => getPrismaClient()) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  void globalForPrismaAuth;
}
